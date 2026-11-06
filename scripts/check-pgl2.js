const fs = require('fs');
const s = fs.readFileSync('supabase/seeds/events/pgl-major-singapore-2026.sql', 'utf8');

function parseSeed(afterIdx) {
  const open = s.indexOf('$seed$', afterIdx);
  const close = s.indexOf('$seed$::jsonb', open);
  return JSON.parse(s.slice(open + 6, close));
}

const v = parseSeed(s.indexOf('FROM jsonb_populate_record(NULL::events.venues'));
console.log('venue OK id=', v.id, 'name=', v.name, 'seated=', v.seated_capacity, 'standing=', v.standing_capacity, 'tz=', v.timezone, 'amenities=', v.amenities.length);
const e = parseSeed(s.indexOf('FROM jsonb_populate_record(NULL::events.events'));
console.log('event OK id=', e.id, 'sold=', e.sold, 'cap=', e.capacity, 'rev=', e.revenue, 'date=', e.event_date, 'time=', e.event_time, 'listable=', e.is_listable, 'venue_id=', e.venue_id);
console.log('gallery len=', e.gallery.length, 'cover=', e.cover_url.slice(0, 60));

const req = ['description','highlights','schedule','guests','guestsDisplay','faq','map','ticketGroups','tickets','ticketSold','regSettings','ctas','questions','guidelines','organizerAvatar','languages','tags','galleryDisplay','sectionNotes','disclaimer','infographics','pageDesign','packagesPage'];
const missing = req.filter(k => e.metadata[k] === undefined);
console.log('required metadata missing:', missing.length ? missing.join(',') : 'NONE — all present');
console.log('payments=', JSON.stringify(e.metadata.payments), 'rsvp=', JSON.stringify(e.metadata.rsvp), 'ticketRules=', JSON.stringify(e.metadata.ticketRules));
console.log('ticket ids:', e.metadata.tickets.map(t => t.id).join(', '));
console.log('ticketSold:', JSON.stringify(e.metadata.ticketSold));
console.log('bundle items:', JSON.stringify(e.metadata.bundles[0].items));
console.log('pageDesign blocks:', e.metadata.pageDesign.blocks.map(b => b.type).join(','), '=', e.metadata.pageDesign.blocks.length);
console.log('pageDesign sidebarBlocks:', e.metadata.pageDesign.sidebarBlocks.map(b => b.type).join(','));
console.log('infographics:', e.metadata.infographics.map(i => i.id).join(','));
console.log('guests:', e.metadata.guests.map(g => g.name).join(' | '));
const thumbs = new Set();
for (const m of s.matchAll(/https:\/\/upload\.wikimedia\.org\/[^\s"'\)]+/g)) thumbs.add(m[0]);
console.log('distinct upload.wikimedia.org URLs:', thumbs.size);
console.log('thumb.wikimedia.org occurrences:', (s.match(/thumb\.wikimedia\.org/g) || []).length);
console.log('total bytes:', Buffer.byteLength(s), 'lines:', s.split('\n').length);
console.log('$seed$ count:', (s.match(/\$seed\$/g) || []).length);
console.log('INSERT count:', (s.match(/INSERT INTO events\./g) || []).length, 'ON CONFLICT count:', (s.match(/ON CONFLICT \(id\) DO UPDATE/g) || []).length);
