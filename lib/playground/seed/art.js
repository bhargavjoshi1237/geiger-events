// Generated cover art for seeded events, venues and records: a deterministic SVG data URI per
// key, so covers render offline and never point at a third-party image host.

const PALETTES = [
  ["#E8613C", "#2F6F73", "#F6E7D8"],
  ["#2F6F73", "#123638", "#9ED4CF"],
  ["#6C5CE7", "#1E1B4B", "#C4B5FD"],
  ["#D4A017", "#5B3A12", "#FDE68A"],
  ["#0984E3", "#0B2545", "#A5D8FF"],
  ["#E84393", "#4A0D2B", "#FBCFE8"],
  ["#00B894", "#073B30", "#A7F3D0"],
  ["#FD7E14", "#3B1F0B", "#FFD8A8"],
];

function hash(key) {
  let h = 2166136261;
  for (const ch of String(key)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Abstract poster-style cover for `key`; `palette` picks a fixed colourway (0..7). */
export function coverArt(key, palette) {
  const h = hash(key);
  const [a, b, c] = PALETTES[(palette ?? h) % PALETTES.length];
  const cx = 200 + (h % 800);
  const cy = 120 + ((h >> 4) % 420);
  const r = 160 + ((h >> 8) % 220);
  const tilt = (h >> 12) % 60;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity=".28"/><circle cx="${1200 - cx}" cy="${675 - cy}" r="${Math.round(r * 0.6)}" fill="none" stroke="${c}" stroke-width="18" opacity=".35"/><rect x="-200" y="${300 + (h % 200)}" width="1600" height="56" fill="${c}" opacity=".18" transform="rotate(-${tilt} 600 337)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
