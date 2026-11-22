import pg from "pg";

// Points pg_cron at the deployed app: stores the base URL + PUSH_CRON_SECRET in events_push.runtime and prints job status.
// Usage: STRING_URI=... PUSH_CRON_SECRET=... node scripts/push-setup.mjs [https://geigerevents.vercel.app/events] [--pause|--resume]
const url = process.env.STRING_URI;
const secret = process.env.PUSH_CRON_SECRET || process.env.CRON_SECRET;
const args = process.argv.slice(2);
const baseUrl = (args.find((a) => /^https:\/\//.test(a)) || process.env.PUSH_BASE_URL || "https://geigerevents.vercel.app/events").replace(/\/$/, "");
const paused = args.includes("--pause") ? true : args.includes("--resume") ? false : null;

if (!url) throw new Error("Set STRING_URI to the Postgres connection string.");
if (!secret) throw new Error("Set PUSH_CRON_SECRET (or CRON_SECRET) to the same value the Vercel project uses.");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(
    `update events_push.runtime set base_url = $1, secret = $2, paused = coalesce($3, paused), updated_at = now() where id`,
    [baseUrl, secret, paused],
  );
  const { rows } = await client.query("select events_push.scheduler_status() as s");
  const s = rows[0].s;
  console.log(`runtime: ${baseUrl} · configured=${s.configured} · paused=${s.globalPaused}`);
  for (const job of s.jobs) console.log(`job ${job.name} (${job.schedule}) active=${job.active} last=${job.lastStatus ?? "never"}`);
  if (!s.jobs.length) console.log("No pg_cron jobs found — enable pg_cron and pg_net, then re-run the migration's scheduler block.");
  // The app reaches events_push through PostgREST, which only serves exposed schemas.
  const { rows: cfg } = await client.query("select rolconfig from pg_roles where rolname = 'authenticator'");
  const entry = (cfg[0]?.rolconfig || []).find((c) => c.startsWith("pgrst.db_schemas=")) || "";
  if (!entry.slice("pgrst.db_schemas=".length).split(/[,\s]+/).includes("events_push")) {
    console.log("WARNING: events_push isn't in the API's exposed schemas. Add it in Supabase → Project Settings → API → Exposed schemas.");
  }
} finally {
  await client.end();
}
