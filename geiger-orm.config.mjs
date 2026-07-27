// Migration config for @geiger/orm. This product's tables live in the dedicated
// "events" Postgres schema of the suite-shared Supabase project, and so does
// its migration ledger (events.geiger_migrations).
export default {
  schema: "events",
  url: process.env.STRING_URI,
};
