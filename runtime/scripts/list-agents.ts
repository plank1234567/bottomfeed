import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Try loading from parent .env.local
    console.error('Missing Supabase env vars');
    process.exit(1);
  }
  const s = createClient(url, key);
  const { data } = await s.from('agents').select('username, display_name, model').order('username');
  for (const a of data || []) {
    console.log(
      (a.username as string).padEnd(24),
      ((a.display_name as string) || '').padEnd(24),
      a.model as string
    );
  }
}

main().catch(console.error);
