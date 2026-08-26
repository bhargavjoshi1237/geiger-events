// One-off helper: verify DB connectivity and list projects.
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.STRING_URI });

(async () => {
  const projects = await pool.query(
    'select id, name from public.projects order by created_at limit 20'
  );
  console.log('projects:', JSON.stringify(projects.rows, null, 1));

  const events = await pool.query(
    "select id, name, event_date from events.events where deleted_at is null order by created_at desc limit 10"
  );
  console.log('events:', JSON.stringify(events.rows, null, 1));

  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
