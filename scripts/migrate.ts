/**
 * Database migration runner for Supabase.
 * Reads SQL files from supabase/ directory, tracks applied migrations,
 * and executes new ones in order.
 *
 * Usage: npx tsx scripts/migrate.ts
 * Status: npx tsx scripts/migrate.ts --status
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'supabase');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure the _migrations tracking table exists. */
async function ensureMigrationsTable(): Promise<void> {
  const { error } = await supabase.rpc('raw_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  });

  // If the RPC doesn't exist, fall back to a raw REST call via the SQL endpoint
  if (error) {
    // Try using the /rest/v1/rpc endpoint is not available, use the SQL API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/raw_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey!,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        query: `
          CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `,
      }),
    });

    if (!response.ok) {
      // Last resort: try to create via supabase-js insert to check if table exists
      const { error: checkError } = await supabase.from('_migrations').select('id').limit(1);

      if (checkError && checkError.code === '42P01') {
        // Table doesn't exist - we need the SQL endpoint
        console.error(
          'Cannot create _migrations table automatically.\n' +
            'Please run this SQL in the Supabase SQL Editor first:\n\n' +
            '  CREATE TABLE IF NOT EXISTS _migrations (\n' +
            '    id SERIAL PRIMARY KEY,\n' +
            '    name TEXT NOT NULL UNIQUE,\n' +
            '    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()\n' +
            '  );\n\n' +
            'Then re-run this script.'
        );
        process.exit(1);
      }
      // If no error or different error, table might already exist
    }
  }
}

/** Get the list of already-applied migration names. */
async function getAppliedMigrations(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('_migrations')
    .select('name')
    .order('id', { ascending: true });

  if (error) {
    // Table might not exist yet — treat as empty
    if (error.code === '42P01') return new Set();
    throw new Error(`Failed to query _migrations: ${error.message}`);
  }

  return new Set((data || []).map((row: { name: string }) => row.name));
}

/** Discover SQL files in the supabase/ directory, sorted alphabetically. */
function discoverMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migration directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && f !== 'seed.sql')
    .sort((a, b) => {
      // schema.sql always comes first
      if (a === 'schema.sql') return -1;
      if (b === 'schema.sql') return 1;
      return a.localeCompare(b);
    });

  return files;
}

/** Execute a single SQL migration file. */
async function executeMigration(fileName: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, fileName);
  const sql = fs.readFileSync(filePath, 'utf-8');

  // Use the Supabase SQL API (via fetch) to execute raw SQL
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/raw_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseServiceKey!,
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Migration ${fileName} failed: ${body}`);
  }
}

/** Record a migration as applied. */
async function recordMigration(fileName: string): Promise<void> {
  const { error } = await supabase.from('_migrations').insert({ name: fileName });

  if (error) {
    throw new Error(`Failed to record migration ${fileName}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function showStatus(): Promise<void> {
  const applied = await getAppliedMigrations();
  const files = discoverMigrationFiles();

  console.log('\nMigration Status');
  console.log('================\n');

  if (files.length === 0) {
    console.log('No migration files found in supabase/ directory.\n');
    return;
  }

  let pendingCount = 0;
  for (const file of files) {
    const status = applied.has(file) ? 'APPLIED' : 'PENDING';
    if (status === 'PENDING') pendingCount++;
    const marker = applied.has(file) ? '\u2713' : '\u2022';
    console.log(`  ${marker} ${file} [${status}]`);
  }

  console.log(`\n${applied.size} applied, ${pendingCount} pending\n`);
}

async function runMigrations(): Promise<void> {
  console.log('\nBottomFeed Migration Runner');
  console.log('==========================\n');

  // Step 1: Ensure tracking table
  console.log('Checking _migrations table...');
  await ensureMigrationsTable();

  // Step 2: Get applied migrations
  const applied = await getAppliedMigrations();
  console.log(`Found ${applied.size} previously applied migration(s).\n`);

  // Step 3: Discover migration files
  const files = discoverMigrationFiles();
  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('All migrations are up to date. Nothing to apply.\n');
    return;
  }

  console.log(`Found ${pending.length} pending migration(s):\n`);
  for (const file of pending) {
    console.log(`  - ${file}`);
  }
  console.log('');

  // Step 4: Execute pending migrations
  let appliedCount = 0;
  let failed = false;

  for (const file of pending) {
    process.stdout.write(`Applying ${file}...`);
    try {
      await executeMigration(file);
      await recordMigration(file);
      appliedCount++;
      console.log(' OK');
    } catch (err) {
      console.log(' FAILED');
      console.error(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
      failed = true;
      break;
    }
  }

  // Step 5: Summary
  console.log(`\n${appliedCount}/${pending.length} migration(s) applied.`);

  if (failed) {
    console.error('Migration run stopped due to error. Fix the issue and re-run.\n');
    process.exit(1);
  }

  console.log('All migrations applied successfully.\n');
}

// Entry point
const isStatusMode = process.argv.includes('--status');

if (isStatusMode) {
  showStatus().catch(err => {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
} else {
  runMigrations().catch(err => {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
