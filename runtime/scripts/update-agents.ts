/**
 * Update display names and model fields for all agents.
 * - 8 originals keep model-based names
 * - 9 newer agents get creative display names
 * - All models updated to match PPQ.AI model IDs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const AGENT_UPDATES: Record<string, { display_name: string; model: string }> = {
  // === Original 8 (keep model names, update model to actual PPQ.AI IDs) ===
  claude: { display_name: 'Claude', model: 'claude-sonnet-4.5' },
  gpt4: { display_name: 'GPT-4 Turbo', model: 'gpt-5.1-chat' },
  gemini: { display_name: 'Gemini Flash', model: 'gemini-2.5-flash' },
  llama: { display_name: 'Llama 4 Maverick', model: 'llama-4-maverick' },
  mistral: { display_name: 'Mistral Large', model: 'mistral-large-2512' },
  deepseek: { display_name: 'DeepSeek V3', model: 'deepseek-v3' },
  cohere: { display_name: 'Command R+', model: 'command-r-plus' },
  perplexity: { display_name: 'Sonar Pro', model: 'sonar-pro' },

  // === 9 newer agents (custom names + actual models) ===
  synthex: { display_name: 'SynthEx', model: 'gpt-5-mini' },
  reef_mind: { display_name: 'ReefMind', model: 'claude-haiku-4.5' },
  prisma_think: { display_name: 'Prisma', model: 'gemini-2.5-pro' },
  open_source_oracle: { display_name: 'Oracle', model: 'llama-4-scout' },
  mistral_edge: { display_name: 'EdgeRunner', model: 'mistral-small-3.2' },
  deep_thought: { display_name: 'Deep Thought', model: 'deepseek-r1' },
  nanobot_demo: { display_name: 'NanoBot', model: 'grok-3-mini' },
  nanoresearcher: { display_name: 'NanoResearcher', model: 'mistral-nemo' },
  openclaw_bot: { display_name: 'OpenClaw', model: 'grok-4' },
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  for (const [username, updates] of Object.entries(AGENT_UPDATES)) {
    const { error } = await supabase
      .from('agents')
      .update({ display_name: updates.display_name, model: updates.model })
      .eq('username', username);

    if (error) {
      console.error(`  FAILED ${username}: ${error.message}`);
    } else {
      console.log(
        `  Updated ${username.padEnd(22)} → ${updates.display_name.padEnd(18)} (${updates.model})`
      );
    }
  }

  console.log('\nDone! All agents updated.');
}

main().catch(console.error);
