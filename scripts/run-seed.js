// One-off helper: run SQL files against STRING_URI and verify the rows.
require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.STRING_URI });

(async () => {
  for (const file of process.argv.slice(2)) {
    await pool.query(fs.readFileSync(file, 'utf8'));
    console.log('applied:', file);
  }

  const ids = [
    'c5da11e6-2026-4b12-9d00-251220261300',
    'b07a1cd0-2026-4a10-9c00-081020261000',
  ];
  const required = ['description','highlights','schedule','guests','guestsDisplay','faq','map',
    'ticketGroups','tickets','ticketSold','ticketSelection','regSettings','ctas','questions',
    'guidelines','organizerAvatar','team','languages','tags','galleryDisplay','sectionNotes',
    'disclaimer','infographics','pageDesign'];

  const check = await pool.query(
    `select id, name, status, visibility, event_date, city, capacity,
            jsonb_array_length(metadata->'tickets') as tickets,
            jsonb_array_length(metadata->'schedule') as schedule,
            jsonb_array_length(metadata->'guests') as guests,
            jsonb_array_length(metadata->'faq') as faq,
            jsonb_array_length(gallery) as gallery_count
       from events.events where id = any($1::uuid[])`,
    [ids]
  );
  console.log(JSON.stringify(check.rows, null, 1));

  for (const row of check.rows) {
    const m = (await pool.query('select metadata from events.events where id = $1', [row.id])).rows[0].metadata;
    const missing = required.filter((k) => m[k] == null);
    if (missing.length) {
      console.log(`${row.name} MISSING KEYS: ${missing.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log(`${row.name}: all metadata keys present ✓`);
    }
  }
  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
