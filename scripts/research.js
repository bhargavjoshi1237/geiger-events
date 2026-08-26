// Final re-verify, 22s spacing (Wikimedia per-IP quota).
const UA = 'GeigerEventsSeedVerifier/1.0 (local dev seed prep; one-off verification)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function head(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
    return res.status;
  } catch {
    return 'ERR';
  }
}

(async () => {
  const urls = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Singapore_Indoor_Stadium_interior_-_6_Nov_2024.jpg/1920px-Singapore_Indoor_Stadium_interior_-_6_Nov_2024.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1920px-Singapore_Indoor_Stadium.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Supertree_Grove_at_night.jpg/1920px-Supertree_Grove_at_night.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/The_MongolZ.svg/500px-The_MongolZ.svg.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Cosplay_at_NYCC_%2860421%29.jpg/1920px-Cosplay_at_NYCC_%2860421%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg/1920px-New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Javits_Center_November_2022.jpg/1920px-Javits_Center_November_2022.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Jacob_Javits_Convention_Center.jpg/1920px-Jacob_Javits_Convention_Center.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG/1920px-NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Hudson_Yards_Vessel_IMG_3553_HLG.jpg/1920px-Hudson_Yards_Vessel_IMG_3553_HLG.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Fifteen_Hudson_Yards_and_Vessel.jpg/1920px-Fifteen_Hudson_Yards_and_Vessel.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/PGL_Logo.png/500px-PGL_Logo.png',
  ];
  let bad = 0;
  for (const u of urls) {
    const s = await head(u);
    if (s !== 200) bad++;
    console.log(s, '|', u);
    await sleep(22000);
  }
  console.log('\nnon-200 count:', bad);
})();
