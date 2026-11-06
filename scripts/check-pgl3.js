const fs = require('fs');
const s = fs.readFileSync('supabase/seeds/events/pgl-major-singapore-2026.sql', 'utf8');
const uniq = [...new Set((s.match(/https:\/\/upload\.wikimedia\.org\/[^\s"'\)]+/g) || []))];
console.log('distinct upload.wikimedia.org URLs:', uniq.length);
for (const u of uniq) console.log(u);
const thumbs = [...new Set((s.match(/https:\/\/thumb\.wikimedia\.org\/[^\s"'\)]+/g) || []))];
console.log('distinct thumb.wikimedia.org URLs:', thumbs.length);
for (const t of thumbs) console.log(t);
