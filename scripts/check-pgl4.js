const UA = 'GeigerEventsSeedChecker/1.0 (local dev seed prep)';
const urls = [
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Singapore_Indoor_Stadium%2C_Aug_07.JPG/1280px-Singapore_Indoor_Stadium%2C_Aug_07.JPG',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Kallang_Indoor_Stadium_%288151029247%29.jpg/1280px-Kallang_Indoor_Stadium_%288151029247%29.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Singapore_National_Stadium_from_Kallang_Footbridge.jpg/1280px-Singapore_National_Stadium_from_Kallang_Footbridge.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/ESport_IFNG_Munich_20-Nov-11_Stage3.jpg/1280px-ESport_IFNG_Munich_20-Nov-11_Stage3.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/ESport_IFNG_Munich_20-Nov-11_Stage4.jpg/1280px-ESport_IFNG_Munich_20-Nov-11_Stage4.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/IEM_2015_San_Jose_Day_2_-_17.jpg/1280px-IEM_2015_San_Jose_Day_2_-_17.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/SK_Gaming_vs._G2_Esports_-_ESL_One_Cologne_2016_groups.jpg/1280px-SK_Gaming_vs._G2_Esports_-_ESL_One_Cologne_2016_groups.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Merli%C3%B3n%2C_Marina_Bay%2C_Singapur%2C_2023-08-18%2C_DD_45-47_HDR.jpg/1280px-Merli%C3%B3n%2C_Marina_Bay%2C_Singapur%2C_2023-08-18%2C_DD_45-47_HDR.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/6/64/Entrance_to_the_Singapore_Indoor_Stadium.jpg',
];
(async () => {
  let ok = 0;
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://commons.wikimedia.org/' } });
      const buf = await res.arrayBuffer();
      const good = res.status === 200 && buf.byteLength > 10000;
      if (good) ok++;
      console.log(good ? 'OK  ' : 'FAIL', res.status, buf.byteLength, u.slice(0, 80));
    } catch (e) { console.log('ERR', e.message, u.slice(0, 60)); }
  }
  console.log(`HEAD/GET verified: ${ok}/${urls.length}`);
})();
