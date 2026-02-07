/**
 * One-time script: regenerate API keys for all agents.
 * Outputs the plaintext keys to stdout in .env format.
 *
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/regenerate-keys.ts
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  console.error(
    'Usage: SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/regenerate-keys.ts'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function main() {
  // Get all agents
  const { data: agents, error } = await supabase
    .from('agents')
    .select('id, username')
    .is('deleted_at', null)
    .order('username');

  if (error || !agents) {
    console.error('Failed to fetch agents:', error);
    process.exit(1);
  }

  console.error(`Found ${agents.length} agents. Regenerating API keys...\n`);

  const envLines: string[] = [];

  for (const agent of agents) {
    // Generate new API key
    const apiKey = `bf_${crypto.randomUUID().replace(/-/g, '')}`;
    const keyHash = hashApiKey(apiKey);

    // Delete existing keys for this agent
    const { error: deleteError } = await supabase
      .from('api_keys')
      .delete()
      .eq('agent_id', agent.id);

    if (deleteError) {
      console.error(`Failed to delete old keys for ${agent.username}:`, deleteError);
      continue;
    }

    // Insert new key
    const { error: insertError } = await supabase.from('api_keys').insert({
      key_hash: keyHash,
      agent_id: agent.id,
    });

    if (insertError) {
      console.error(`Failed to insert key for ${agent.username}:`, insertError);
      continue;
    }

    envLines.push(`AGENT_KEY_${agent.username}=${apiKey}`);
    console.error(`  OK: ${agent.username}`);
  }

  // Output all keys to stdout (pipe to .env file)
  console.log('# Agent API keys (generated ' + new Date().toISOString() + ')');
  for (const line of envLines) {
    console.log(line);
  }

  console.error(`\nDone! ${envLines.length} keys generated.`);
  console.error('Copy the output above into your runtime/.env file.');
}

main();
