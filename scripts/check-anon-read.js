// One-off helper: verify events are readable via the public anon key,
// exactly as app/e/[id]/page.js fetches them in the browser.
require('dotenv').config();

const ids = [
  'c5da11e6-2026-4b12-9d00-251220261300',
  'b07a1cd0-2026-4a10-9c00-081020261000',
];

(async () => {
  for (const id of ids) {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL +
      '/rest/v1/events?select=id,name,status,visibility,is_listable&' +
      'id=eq.' + id + '&deleted_at=is.null';
    const res = await fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'Accept-Profile': 'events',
      },
    });
    const json = await res.json();
    console.log(id, '→ HTTP', res.status, json.length ? json[0].name : '(not found)');
  }
})();
