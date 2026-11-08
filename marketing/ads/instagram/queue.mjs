#!/usr/bin/env node
// Controls the Instagram queue stored in Supabase Storage.
//
//   node marketing/ads/instagram/queue.mjs --status
//   node marketing/ads/instagram/queue.mjs --resume
//   node marketing/ads/instagram/queue.mjs --pause
//   node marketing/ads/instagram/queue.mjs --start 2026-11-15
//   node marketing/ads/instagram/queue.mjs --reset 42
//   node marketing/ads/instagram/queue.mjs --reset-errors
//
// Add --local to operate on the checked-in queue.json instead of Supabase.

import { loadEnv, storageConfig, readQueue, writeQueue, queueCounts, nextQueued } from "./lib.mjs";

const argv = process.argv.slice(2);
const has = (name) => argv.includes(name);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1] ?? fallback;
};

const env = loadEnv();
const { url: supabase, key: serviceKey } = storageConfig(env);
const local = has("--local");

async function main() {
  const queue = await readQueue({ supabase, serviceKey, local });
  const counts = queueCounts(queue);
  const where = local ? "local queue.json" : "Supabase";

  function summary() {
    const next = nextQueued(queue);
    console.log(`${where} · ${queue.posts.length} posts · ${queue.paused ? "PAUSED" : "LIVE"}`);
    console.log(`  ${Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(" · ")}`);
    if (next) {
      console.log(`  next: #${next.number} ${next.scheduledAt} — ${next.hook}`);
    } else {
      console.log("  next: none");
    }
    const published = queue.posts
      .filter((post) => post.status === "published")
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    if (published.length) {
      const last = published[0];
      console.log(`  last published: #${last.number} ${last.publishedAt}${last.permalink ? ` — ${last.permalink}` : ""}`);
    }
    if (queue.lastRunAt) console.log(`  last run: ${queue.lastRunAt}`);
    if (queue.lastError) console.log(`  last error: ${queue.lastError}`);
  }

  async function save() {
    queue.updatedAt = new Date().toISOString();
    await writeQueue(queue, { supabase, serviceKey, local });
    console.log(`Saved to ${where}.`);
  }

  if (has("--pause")) {
    queue.paused = true;
    await save();
    summary();
    return 0;
  }

  if (has("--resume")) {
    queue.paused = false;
    await save();
    summary();
    console.log("\nThe drip is live. The GitHub Action will publish whatever is due, one post per run.");
    return 0;
  }

  if (has("--start")) {
    const raw = arg("--start");
    const start = new Date(raw);
    if (!raw || Number.isNaN(start.getTime())) {
      console.error("Usage: --start YYYY-MM-DD (UTC)");
      return 1;
    }
    const slots = queue.slotHoursUtc || [9, 13, 18];
    let index = 0;
    for (const post of queue.posts) {
      if (post.status !== "queued") continue;
      const day = Math.floor(index / slots.length);
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      date.setUTCDate(date.getUTCDate() + day);
      date.setUTCHours(slots[index % slots.length], 0, 0, 0);
      post.scheduledAt = date.toISOString();
      index++;
    }
    await save();
    const first = queue.posts.find((post) => post.status === "queued");
    const last = [...queue.posts].reverse().find((post) => post.status === "queued");
    console.log(`Rescheduled ${index} queued posts.`);
    if (first && last) console.log(`  ${first.scheduledAt} → ${last.scheduledAt}`);
    return 0;
  }

  if (has("--skip") || has("--mark-published")) {
    const manual = has("--mark-published");
    const number = Number(arg(manual ? "--mark-published" : "--skip"));
    const post = queue.posts.find((p) => p.number === number);
    if (!post) {
      console.log(`Post #${number} not found.`);
      return 1;
    }
    if (post.status === "published") {
      console.log(`#${post.number} is already marked published${post.permalink ? ` — ${post.permalink}` : ""}.`);
      return 0;
    }
    if (manual) {
      post.status = "published";
      post.publishedAt = new Date().toISOString();
      post.permalink = arg("--permalink", null);
      post.manual = true;
      post.error = null;
      post.lastError = null;
      console.log(`Marked #${post.number} published${post.permalink ? ` — ${post.permalink}` : ""}.`);
    } else {
      post.status = "skipped";
      post.skippedAt = new Date().toISOString();
      console.log(`Skipped #${post.number} — ${post.hook}`);
    }
    await save();
    return 0;
  }

  if (has("--reset") || has("--reset-errors")) {
    const number = has("--reset") ? Number(arg("--reset")) : null;
    const targets = queue.posts.filter((post) => (number === null ? post.status === "error" : post.number === number));
    if (!targets.length) {
      console.log(number === null ? "No errored posts." : `Post #${number} not found.`);
      return 0;
    }
    for (const post of targets) {
      if (post.status === "published") {
        console.log(`Skipping #${post.number}: already published at ${post.permalink || post.publishedAt}. Publishing again would duplicate it.`);
        continue;
      }
      post.status = "queued";
      post.attempts = 0;
      post.error = null;
      post.lastError = null;
      console.log(`Re-queued #${post.number} — ${post.hook}`);
    }
    await save();
    return 0;
  }

  summary();
  if (counts.queued) {
    console.log("\nNext queued posts:");
    for (const post of queue.posts.filter((p) => p.status === "queued").slice(0, 5)) {
      console.log(`  #${post.number} ${post.scheduledAt} · ${post.productName} · ${post.hook}`);
    }
  }
  return 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
