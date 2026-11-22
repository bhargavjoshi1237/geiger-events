import pg from "pg";

// Sends a test push to a member's registered devices through the live pipeline
// (events_push.notifications → pg_net kick → /api/internal/push/dispatch → Expo → FCM/APNs), then prints what Expo said.
// Without --send it only lists the member's devices.
// Usage: node --env-file=.env scripts/push-test.mjs <member email> [--send] [--title "…"] [--body "…"]
const url = process.env.STRING_URI;
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const email = args.find((a) => a.includes("@"));
const send = args.includes("--send");
const title = flag("--title") || "Push notifications are working";
const body = flag("--body") || "This is a test from the Geiger Events team.";

if (!url) throw new Error("Set STRING_URI to the Postgres connection string (or run with --env-file=.env).");
if (!email) throw new Error("Pass the member's email: node --env-file=.env scripts/push-test.mjs you@example.com [--send]");

const mask = (token) => token.replace(/\[(.*)\]$/, (_, t) => `[…${t.slice(-6)}]`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows: members } = await client.query("select events_push.member_for_email($1) as id", [email]);
  const memberId = members[0]?.id;
  if (!memberId) throw new Error(`No portal member for ${email}. Sign in to the app with that email first.`);

  const { rows: devices } = await client.query(
    `select platform, app_version, push_token, last_seen_at from events_push.devices
     where member_id = $1 and deleted_at is null order by last_seen_at desc nulls last`,
    [memberId],
  );
  console.log(`member ${email} (${memberId}) · ${devices.length} device(s)`);
  for (const d of devices) console.log(`  ${d.platform} v${d.app_version ?? "?"} ${mask(d.push_token)} last seen ${d.last_seen_at?.toISOString() ?? "never"}`);
  if (!devices.length) throw new Error("No device registered. Open the app, sign in and allow notifications.");
  if (!send) {
    console.log("Add --send to push a test notification to these devices.");
  } else {
    const dedupe = `test:cli:${Date.now()}`;
    const ref = { copy: { title, body, route: "/notifications" } };
    await client.query("select events_push.enqueue(null, null, 'test', array[$1::uuid], $2::jsonb, $3)", [memberId, ref, dedupe]);
    const { rows: queued } = await client.query("select id from events_push.notifications where dedupe_key = $1", [`${dedupe}:${memberId}`]);
    const id = queued[0].id;
    // Wake the dispatcher now instead of waiting for the next 30 s pg_cron tick.
    await client.query("select events_push.kick()");
    console.log(`queued ${id}, waiting for the dispatcher…`);

    let row;
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      ({ rows: [row] } = await client.query("select status, skip_reason, last_error, sent_at from events_push.notifications where id = $1", [id]));
      if (!["queued", "sending"].includes(row.status)) break;
    }
    console.log(`status: ${row.status}${row.skip_reason ? ` (${row.skip_reason})` : ""}${row.last_error ? ` · ${row.last_error}` : ""}`);
    const { rows: deliveries } = await client.query(
      "select platform, push_token, status, error, ticket_id from events_push.deliveries where notification_id = $1 order by created_at",
      [id],
    );
    for (const d of deliveries) console.log(`  ${d.platform} ${mask(d.push_token)} ticket ${d.status}${d.error ? ` · ${d.error}` : ""}`);
    if (row.status === "queued") console.log("Still queued — check events_push.runtime (paused? base_url/secret set?) and the pg_cron jobs.");
    // An ok ticket means Expo accepted it; FCM/APNs delivery is confirmed by the receipt the dispatcher checks ~15 min later.
  }
} finally {
  await client.end();
}
