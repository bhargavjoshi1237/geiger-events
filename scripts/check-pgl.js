const fs = require('fs');
const p = 'supabase/seeds/events/pgl-major-singapore-2026.sql';
const sql = fs.readFileSync(p, 'utf8');
const opens = (sql.match(/\$seed\$/g) || []).length;
console.log('$seed$ markers:', opens);
console.log('INSERT venues:', (sql.match(/INSERT INTO events\.venues/g) || []).length);
console.log('INSERT events:', (sql.match(/INSERT INTO events\.events/g) || []).length);
console.log('ON CONFLICT:', (sql.match(/ON CONFLICT/g) || []).length);
console.log('6c5a occurrences:', (sql.match(/6c5a2026/g) || []).length);
console.log('trailing-comma-before-]:', (sql.match(/,\s*\]/g) || []).length);
console.log('trailing-comma-before-}:', (sql.match(/,\s*\}/g) || []).length);
const blocks = [...sql.matchAll(/\$seed\$([\s\S]*?)\$seed\$::jsonb/g)];
console.log('json blocks found:', blocks.length);
blocks.forEach((b, i) => {
  if (i === 0) console.log('block 0: scanned from header comment tokens — venue parsed separately below');
  try {
    const j = JSON.parse(b[1]);
    console.log('block', i, 'OK top-level keys:', Object.keys(j).length, 'id=', j.id);
    if (i === 1) {
      const m = j.metadata;
      console.log('  metadata keys:', Object.keys(m).join(', '));
      console.log('  tickets:', m.tickets.length, 'bundles:', m.bundles.length, 'packages:', m.packages.items.length, 'schedule:', m.schedule.length, 'guests:', m.guests.length, 'faq:', m.faq.length, 'guidelines:', m.guidelines.length, 'highlights:', m.highlights.length, 'questions:', m.questions.length);
      console.log('  ticketGroups:', m.ticketGroups.length, 'infographics:', m.infographics.length, 'sectionNotes:', m.sectionNotes.length, 'pageDesign blocks:', m.pageDesign.blocks.length, 'sidebarBlocks:', m.pageDesign.sidebarBlocks.length);
    }
  } catch (e) {
    console.log('block', i, 'JSON ERROR:', e.message);
  }
});
const urls = [...new Set([...sql.matchAll(/https:\/\/upload\.wikimedia\.org[^\s"'\)]+/g)].map(m => m[0]))];
console.log('distinct wikimedia URLs:', urls.length);
for (const u of urls) console.log(' ', u.slice(0, 130));
console.log('total lines:', sql.split('\n').length, 'bytes:', sql.length);
