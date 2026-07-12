import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SERVICE ROLE key — bypasses RLS so the
// members portal can read org-scoped rows (orders/memberships) and the custom
// auth tables. Import ONLY from server routes: SUPABASE_SERVICE_ROLE_KEY is a
// non-public env var, so it is never bundled to the client (adminClient() just
// returns null there).

export function isAdminConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function adminClient() {
  if (!isAdminConfigured()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: "events" },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
