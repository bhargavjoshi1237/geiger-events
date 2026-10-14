import { createBrowserClient } from '@supabase/ssr';
import { trackSupabaseFetch } from './activity';
import { playgroundHandler } from '@/lib/playground/mode';

export function createClient() {
  // The landing playground serves every query from its in-memory seed.
  const playground = playgroundHandler('createClient');
  if (playground) return playground();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // This app owns the `events` Postgres schema; default all PostgREST
      // table/RPC calls to it (auth + storage are unaffected by db.schema).
      db: {
        schema: 'events',
      },
      global: {
        fetch: trackSupabaseFetch,
      },
    }
  );
}
