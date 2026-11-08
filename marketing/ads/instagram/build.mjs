// Builds the Instagram drip queue from the exported ad PNGs.
// Run: node marketing/ads/instagram/build.mjs
//
// Outputs, next to this file:
//   queue.json     machine-readable schedule (publishing state lives here)
//   calendar.csv   spreadsheet for review / manual scheduling
//   PREVIEW.md     human-readable calendar with every caption
//
// The queue starts paused. Nothing posts until host.mjs has uploaded the images
// and queue.mjs --resume has been run.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { products } from "./products.mjs";
import eventsCopy from "./copy/events.mjs";
import appsCopy from "./copy/apps.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const pngRoot = path.join(repoRoot, "marketing/ads/png");
const copy = { ...eventsCopy, ...appsCopy };

// Sections in dedupe priority order: the polished Events set wins over the
// repeated glass/ads-remix exports of the same creative.
const PRIORITY = [
  "final-ads", "ads", "new-formats", "research-ads", "ui-showcase", "ads-remix", "glass-showcase",
  "studio", "flow", "notes", "forms", "grey", "assets", "campaign", "comms", "content", "docs", "pods", "property",
];
const EVENTS_SECTIONS = new Set(["final-ads", "research-ads", "glass-showcase", "ui-showcase", "ads-remix", "ads"]);
const NEW_FORMATS_PRODUCT = {
  "1a": "events", "2a": "grey", "3a": "studio", "4a": "comms", "5a": "forms",
  "8a": "assets", "9a": "flow", "10a": "content", "11a": "docs", "12a": "property",
};
// Already published on 8 Nov 2026:
//   https://www.instagram.com/p/DffLWKOlKwg/  (ads/1a)
//   https://www.instagram.com/p/Dfe4URsMZhV/  (ads/1c)
const SKIP = new Set([
  "ads/1a-feed-offer-free-plan-no-platform-fee",
  "ads/1c-feed-hero-ticket-posters-at-the-edges",
]);
const CAROUSELS = [
  {
    section: "research-ads",
    id: "1g",
    files: ["1g-1-feed-carousel-3-cards-after-posh.png", "1g-2-feed-carousel-3-cards-after-posh.png", "1g-3-feed-carousel-3-cards-after-posh.png"],
  },
  {
    section: "ads-remix",
    id: "2g",
    files: ["2g-carousel-3-slides-at-on-one-continuous-slide-1.png", "2g-carousel-3-slides-at-on-one-continuous-slide-2.png", "2g-carousel-3-slides-at-on-one-continuous-slide-3.png"],
  },
];
const SLOT_HOURS = [9, 13, 18];
const START_DATE = "2026-11-09";
const POSTS_PER_DAY = SLOT_HOURS.length;

function productFor(section, id) {
  if (section === "new-formats") return NEW_FORMATS_PRODUCT[id.split("-")[0]] || "studio";
  return EVENTS_SECTIONS.has(section) ? "events" : section;
}

function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), hash: crypto.createHash("sha1").update(buf).digest("hex") };
}

// 1. scan every feed-sized PNG, first occurrence of each hash wins
const seen = new Set();
const posts = [];
for (const section of PRIORITY) {
  const dir = path.join(pngRoot, section);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.toLowerCase().endsWith(".png")) continue;
    const full = path.join(dir, file);
    const { w, h, hash } = pngSize(full);
    const ratio = w / h;
    if (!(Math.abs(ratio - 1) < 0.001 || Math.abs(ratio - 0.8) < 0.001)) continue;
    if (seen.has(hash)) continue;
    seen.add(hash);
    const id = file.replace(/\.png$/i, "");
    if (SKIP.has(`${section}/${id}`)) continue;
    posts.push({
      section,
      id,
      product: productFor(section, id),
      images: [{ local: `marketing/ads/png/${section}/${file}`, file }],
      w, h,
    });
  }
}

// 2. replace the individual carousel slides with one carousel post each
for (const carousel of CAROUSELS) {
  const dir = path.join(pngRoot, carousel.section);
  const slideSet = new Set(carousel.files.map((f) => `${carousel.section}/${f}`));
  for (let i = posts.length - 1; i >= 0; i--) {
    if (slideSet.has(`${posts[i].section}/${posts[i].images[0].file}`)) posts.splice(i, 1);
  }
  const images = carousel.files.map((file) => {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) throw new Error(`Missing carousel slide: ${full}`);
    return { local: `marketing/ads/png/${carousel.section}/${file}`, file };
  });
  posts.push({ section: carousel.section, id: carousel.id, product: "events", images, w: 1080, h: 1350, carousel: true });
}

// 3. attach copy + tags
const allTags = [];
let rotation = 0;
for (const post of posts) {
  const key = `${post.section}/${post.id}`;
  const c = copy[key];
  if (!c) throw new Error(`No copy for ${key}`);
  const p = products[post.product];
  if (!p) throw new Error(`No product for ${post.product}`);
  // Rotate the product tag list so neighbouring posts don't share an identical set.
  const start = rotation++ % 3;
  const [brand, ...rest] = p.tags;
  const rotated = [...rest.slice(start), ...rest.slice(0, start)];
  const tags = ["#GeigerStudio", brand, ...rotated.slice(0, 7)];
  const hashtags = [...new Set(tags)];
  post.productName = p.name;
  post.cta = p.cta;
  post.hook = c.h;
  post.body = c.b;
  post.alt = c.a;
  post.hashtags = hashtags;
  post.caption = `${c.h}\n\n${c.b}\n\n${p.cta}\n\n${hashtags.join(" ")}`;
  post.status = "queued";
  post.permalink = null;
  post.publishedAt = null;
  post.error = null;
  allTags.push(...hashtags);
}

// 4. order: a short curated launch, then weighted round-robin so one product
// doesn't take over the feed.
const LAUNCH = [
  "final-ads/1c-feed-elevenlabs-frame-early-bird-tiers",
  "studio/1a-square-giant-numeral-glass-allowance",
  "final-ads/1e-feed-elevenlabs-frame-seat-map",
  "new-formats/1a-feed-events-mcp-connected-to-claude",
  "final-ads/1g-feed-elevenlabs-frame-auto-promote",
  "final-ads/1j-feed-inline-in-type",
  "final-ads/1a-square-giant-numeral-glass-receipt",
  "studio/1d-feed-elevenlabs-frame-app-switcher",
  "final-ads/2b-feed-connected-pills-webhooks",
  "flow/1a-feed-elevenlabs-frame-issue-list",
  "final-ads/1k-feed-elevenlabs-frame-workflow",
  "final-ads/1m-feed-elevenlabs-frame-revenue",
];

const order = ["events", "studio", "flow", "notes", "forms", "grey", "assets", "campaign", "comms", "content", "docs", "pods", "property"];
const byKey = new Map(posts.map((p) => [`${p.section}/${p.id}`, p]));
const ordered = [];
for (const key of LAUNCH) {
  const post = byKey.get(key);
  if (!post) throw new Error(`Launch post not found: ${key}`);
  ordered.push(post);
  byKey.delete(key);
}
const buckets = new Map(order.map((p) => [p, []]));
for (const post of byKey.values()) {
  if (!buckets.has(post.product)) buckets.set(post.product, []);
  buckets.get(post.product).push(post);
}
let lastProduct = ordered.at(-1)?.product;
while ([...buckets.values()].some((b) => b.length)) {
  const candidates = order
    .filter((p) => buckets.get(p)?.length && p !== lastProduct)
    .sort((a, b) => buckets.get(b).length - buckets.get(a).length || order.indexOf(a) - order.indexOf(b));
  const pick = candidates[0] || order.find((p) => buckets.get(p)?.length);
  ordered.push(buckets.get(pick).shift());
  lastProduct = pick;
}

// 5. schedule
const start = new Date(`${START_DATE}T00:00:00.000Z`);
ordered.forEach((post, i) => {
  const day = Math.floor(i / POSTS_PER_DAY);
  const slot = SLOT_HOURS[i % POSTS_PER_DAY];
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + day);
  date.setUTCHours(slot, 0, 0, 0);
  post.scheduledAt = date.toISOString();
  post.number = i + 1;
});

// 6. write the queue
const queue = {
  version: 1,
  createdAt: new Date().toISOString(),
  paused: true,
  timezone: "UTC",
  postsPerDay: POSTS_PER_DAY,
  slotHoursUtc: SLOT_HOURS,
  note: "Run host.mjs to fill image URLs, then queue.mjs --resume to start the drip.",
  posts: ordered,
};
fs.writeFileSync(path.join(__dirname, "queue.json"), JSON.stringify(queue, null, 2) + "\n");

// 7. CSV
const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = ["#", "scheduled_at_utc", "product", "media_type", "image_files", "hook", "body", "cta", "hashtags", "caption", "alt_text", "status", "permalink"];
const lines = [header.join(",")];
for (const p of ordered) {
  lines.push([
    p.number, p.scheduledAt, p.productName, p.carousel ? "CAROUSEL" : "IMAGE",
    p.images.map((i) => i.local).join(" | "), p.hook, p.body, p.cta, p.hashtags.join(" "), p.caption, p.alt, p.status, p.permalink || "",
  ].map(csvEscape).join(","));
}
fs.writeFileSync(path.join(__dirname, "calendar.csv"), lines.join("\r\n") + "\r\n");

// 8. preview markdown, grouped by ISO week
const weeks = new Map();
for (const p of ordered) {
  const d = new Date(p.scheduledAt);
  const monday = new Date(d);
  const day = (d.getUTCDay() + 6) % 7;
  monday.setUTCDate(d.getUTCDate() - day);
  const key = monday.toISOString().slice(0, 10);
  if (!weeks.has(key)) weeks.set(key, []);
  weeks.get(key).push(p);
}
const md = [];
md.push(`# Instagram drip — ${ordered.length} feed posts\n`);
md.push(`Generated ${new Date().toISOString().slice(0, 10)}. Starts **${START_DATE}**, ${POSTS_PER_DAY} posts a day at ${SLOT_HOURS.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")} UTC. The queue ships paused.\n`);
md.push(`Images are the 1:1 and 4:5 exports only. The 73 story-format (9:16) images are intentionally excluded.\n`);
for (const [week, list] of weeks) {
  md.push(`\n## Week of ${week}\n`);
  for (const p of list) {
    md.push(`### ${String(p.number).padStart(3, "0")} · ${p.scheduledAt.replace("T", " ").slice(0, 16)} UTC · ${p.productName}`);
    md.push(`**${p.hook}**\n`);
    md.push(p.images.map((i) => `\`${i.local}\``).join("\n"));
    md.push("");
    md.push(p.caption.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n"));
    md.push("");
    md.push(`_Alt:_ ${p.alt}\n`);
  }
}
fs.writeFileSync(path.join(__dirname, "PREVIEW.md"), md.join("\n") + "\n");

console.log(`Built ${ordered.length} posts`);
console.log(`First: ${ordered[0].scheduledAt} — ${ordered[0].hook}`);
console.log(`Last:  ${ordered.at(-1).scheduledAt} — ${ordered.at(-1).hook}`);
const counts = {};
for (const p of ordered) counts[p.productName] = (counts[p.productName] || 0) + 1;
console.log(counts);
