// Find the real Web Summit logo file and its thumb URL.
const UA = 'GeigerEventsSeedChecker/1.0 (local dev seed prep)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchFile(site, q, limit = 10) {
  const url =
    `https://${site}/w/api.php?action=query&format=json` +
    '&generator=search&gsrnamespace=6&gsrlimit=' + limit +
    '&gsrsearch=' + encodeURIComponent(q) +
    '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=500';
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const json = await res.json();
  return Object.values(json?.query?.pages || {})
    .filter((p) => p.imageinfo)
    .map((p) => ({ title: p.title, url: p.imageinfo[0].thumburl || p.imageinfo[0].url }));
}

(async () => {
  for (const site of ['commons.wikimedia.org', 'en.wikipedia.org']) {
    console.log('\n=== ' + site + ' ===');
    const results = await searchFile(site, 'Web Summit logo');
    for (const r of results) console.log(r.title, '|', r.url);
    await sleep(1200);
  }
})();
