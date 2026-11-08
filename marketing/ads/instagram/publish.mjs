#!/usr/bin/env node
// Publishes one due post from the Instagram queue.
//
//   node marketing/ads/instagram/publish.mjs --due --limit 1
//   node marketing/ads/instagram/publish.mjs --dry-run
//   node marketing/ads/instagram/publish.mjs --check
//   node marketing/ads/instagram/publish.mjs --post 12 --force
//
// The queue is stored in Supabase Storage. Images are already hosted there, so
// publishing only needs Instagram credentials plus the Supabase service key.
//
// Env: IG_TOKEN, IG_USER_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//      IG_GRAPH_VERSION (optional, default v23.0)

import { loadEnv, storageConfig, readQueue, writeQueue, queueCounts, nextQueued } from "./lib.mjs";

const GRAPH = "https://graph.facebook.com";
const MAX_POSTS_PER_RUN = 10;
const MAX_ATTEMPTS = 3;
const DUE_GRACE_MS = 5 * 60 * 1000;
const CONTAINER_TIMEOUT_MS = 6 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;

const argv = process.argv.slice(2);
const has = (name) => argv.includes(name);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1] ?? fallback;
};

const env = loadEnv();
const dryRun = has("--dry-run");
const force = has("--force");
const checkOnly = has("--check");
const limit = Math.min(Math.max(Number(arg("--limit", "1")) || 1, 1), MAX_POSTS_PER_RUN);
const postNumber = arg("--post") ? Number(arg("--post")) : null;

const VERSION = env.IG_GRAPH_VERSION || "v23.0";
const token = env.IG_TOKEN;
const igUser = env.IG_USER_ID;

function requireInstagram() {
  if (!token || !igUser) {
    throw new Error("Set IG_TOKEN and IG_USER_ID (or run with --dry-run).");
  }
}

async function graph(path, { method = "GET", params = {} } = {}) {
  const url = new URL(`${GRAPH}/${VERSION}/${path}`);
  const headers = { authorization: `Bearer ${token}` };
  let body;
  if (method === "GET") {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
  } else {
    body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) body.set(key, value);
    }
    headers["content-type"] = "application/x-www-form-urlencoded";
  }
  const res = await fetch(url, { method, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    const message = [e.message, e.error_user_msg].filter(Boolean).join(" — ") || `HTTP ${res.status}`;
    const code = [e.code, e.error_subcode].filter((v) => v !== undefined).join("/");
    throw new Error(`${message}${code ? ` [${code}]` : ""}`);
  }
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForContainer(id) {
  const started = Date.now();
  while (Date.now() - started < CONTAINER_TIMEOUT_MS) {
    const { status_code: status } = await graph(id, { params: { fields: "status_code,status" } });
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Media container ${id} ended as ${status}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Media container ${id} did not finish within ${CONTAINER_TIMEOUT_MS / 60000} minutes`);
}

async function createImageContainer(post, image) {
  const params = { image_url: image.url };
  if (post.alt) params.alt_text = post.alt;
  try {
    return await graph(`${igUser}/media`, { method: "POST", params });
  } catch (error) {
    // Older API versions ignore alt_text; retry rather than fail the post.
    if (post.alt && /alt.?text/i.test(error.message)) {
      delete params.alt_text;
      return graph(`${igUser}/media`, { method: "POST", params });
    }
    throw error;
  }
}

async function publishPost(post) {
  const caption = post.caption || "";
  if (caption.length > 2200) throw new Error(`Caption is ${caption.length} characters (max 2200)`);
  const hashtags = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  if (hashtags > 30) throw new Error(`Caption has ${hashtags} hashtags (max 30)`);

  console.log(`\n→ #${post.number} ${post.productName} · ${post.scheduledAt}`);
  console.log(`  ${post.hook}`);

  let containerId;
  if (post.carousel) {
    if (post.images.length < 2 || post.images.length > 10) {
      throw new Error(`Carousel needs 2–10 slides, got ${post.images.length}`);
    }
    const children = [];
    for (const [index, image] of post.images.entries()) {
      console.log(`  slide ${index + 1}/${post.images.length}: ${image.url}`);
      const { id } = await graph(`${igUser}/media`, {
        method: "POST",
        params: { image_url: image.url, is_carousel_item: "true" },
      });
      await waitForContainer(id);
      children.push(id);
    }
    const { id } = await graph(`${igUser}/media`, {
      method: "POST",
      params: { media_type: "CAROUSEL", children: children.join(","), caption },
    });
    containerId = id;
  } else {
    const image = post.images[0];
    if (!image?.url) throw new Error("Post has no hosted image URL");
    console.log(`  image: ${image.url}`);
    const { id } = await createImageContainer(post, image);
    containerId = id;
  }

  console.log(`  container ${containerId}: waiting for Instagram to fetch the media…`);
  await waitForContainer(containerId);

  const { id: mediaId } = await graph(`${igUser}/media_publish`, {
    method: "POST",
    params: { creation_id: containerId },
  });

  let permalink = null;
  let timestamp = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const media = await graph(mediaId, { params: { fields: "permalink,timestamp" } });
      permalink = media.permalink || permalink;
      timestamp = media.timestamp || timestamp;
      if (permalink) break;
    } catch {
      // The media object can take a moment to appear; retry briefly.
    }
    await sleep(2000);
  }

  console.log(`  published ${mediaId}${permalink ? ` · ${permalink}` : ""}`);
  return { mediaId, permalink, timestamp };
}

function describe(post) {
  return [
    `#${post.number} · ${post.scheduledAt} · ${post.productName} · ${post.carousel ? "CAROUSEL" : "IMAGE"}`,
    `Hook: ${post.hook}`,
    `Caption (${post.caption.length} chars):`,
    post.caption,
    "",
    `Alt: ${post.alt}`,
    ...post.images.map((image, i) => `Image ${i + 1}: ${image.url}`),
  ].join("\n");
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const { url: supabase, key: serviceKey } = storageConfig(env);
  const local = has("--local");
  const queue = await readQueue({ supabase, serviceKey, local });
  const counts = queueCounts(queue);

  console.log(`Queue: ${queue.posts.length} posts · ${queue.paused ? "PAUSED" : "LIVE"} · ` +
    Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · "));
  if (queue.lastRunAt) console.log(`Last run: ${queue.lastRunAt}${queue.lastError ? ` · last error: ${queue.lastError}` : ""}`);

  if (checkOnly) {
    requireInstagram();
    const account = await graph(igUser, { params: { fields: "username,name,media_count" } });
    console.log(`Instagram: @${account.username} · ${account.name || "(no name)"} · ${account.media_count} posts`);
    const next = nextQueued(queue);
    if (next) {
      console.log(`Next queued: #${next.number} at ${next.scheduledAt} — ${next.hook}`);
      for (const image of next.images) {
        try {
          const res = await fetch(image.url, { method: "HEAD" });
          console.log(`  ${res.ok ? "OK  " : "FAIL"} ${res.status} ${res.headers.get("content-type") || ""} ${image.url}`);
        } catch (error) {
          console.log(`  FAIL ${image.url} — ${error.message}`);
        }
      }
    }
    return 0;
  }

  if (queue.paused && !dryRun && !force) {
    console.log("Queue is paused. Nothing published. Run `node marketing/ads/instagram/queue.mjs --resume` to start the drip.");
    return 0;
  }

  const now = Date.now();
  let pool = queue.posts.filter((post) => post.status === "queued");
  let preview = false;
  if (postNumber !== null) {
    if (!Number.isInteger(postNumber)) throw new Error(`--post needs a post number, got ${arg("--post")}`);
    pool = pool.filter((post) => post.number === postNumber);
    if (!pool.length) throw new Error(`Post #${postNumber} is not queued (it may be published, errored, or missing).`);
  } else {
    // A few minutes of grace absorbs GitHub's start delay and clock skew.
    pool = pool.filter((post) => Date.parse(post.scheduledAt) <= now + DUE_GRACE_MS);
    // A dry run before the next slot still previews that post.
    if (!pool.length && dryRun) {
      const next = nextQueued(queue);
      if (next) {
        pool = [next];
        preview = true;
      }
    }
  }
  pool.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));

  if (!pool.length) {
    const next = nextQueued(queue);
    console.log(next
      ? `Nothing due. Next: #${next.number} at ${next.scheduledAt} — ${next.hook}`
      : "Nothing due. Every post is published.");
    return 0;
  }

  console.log(preview
    ? `Nothing due yet; previewing the next post.`
    : `${pool.length} due, ${postNumber === null ? `${limit} this run` : "manual selection"}.`);

  const batch = pool.slice(0, postNumber === null ? limit : 1);

  if (dryRun) {
    for (const post of batch) {
      console.log(`\n${"-".repeat(72)}\n${describe(post)}`);
    }
    console.log(`\n${"-".repeat(72)}\nDry run: nothing was sent to Instagram.`);
    return 0;
  }

  requireInstagram();

  queue.lastRunAt = new Date().toISOString();
  let failed = false;

  for (const post of batch) {
    post.attempts = (post.attempts || 0) + 1;
    post.lastAttemptAt = new Date().toISOString();
    try {
      const result = await publishPost(post);
      post.status = "published";
      post.publishedAt = result.timestamp || new Date().toISOString();
      post.permalink = result.permalink || null;
      post.igMediaId = result.mediaId;
      post.error = null;
      post.lastError = null;
      queue.lastError = null;
      console.log(`  queue saved: #${post.number} published.`);
    } catch (error) {
      post.lastError = error.message;
      post.error = error.message;
      if (post.attempts >= MAX_ATTEMPTS) {
        post.status = "error";
        console.log(`  giving up after ${post.attempts} attempts: ${error.message}`);
      } else {
        console.log(`  attempt ${post.attempts}/${MAX_ATTEMPTS} failed: ${error.message} (will retry)`);
      }
      queue.lastError = `#${post.number}: ${error.message}`;
      failed = true;
    }
    await writeQueue(queue, { supabase, serviceKey, local });
    if (post.status !== "published") break;
  }

  const after = queueCounts(queue);
  console.log(`\nDone. ${Object.entries(after).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  return failed ? 1 : 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  });
