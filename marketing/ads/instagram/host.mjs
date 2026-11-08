// Converts every queued PNG to JPEG, uploads it to the public Supabase bucket,
// verifies the URL Instagram will fetch, then uploads the queue itself.
//
// Run: node marketing/ads/instagram/host.mjs
// Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_URL)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readQueue } from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const queuePath = path.join(__dirname, "queue.json");

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    const p = path.join(repoRoot, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const supabase = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabase || !key) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
const bucket = "content";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "geiger-ig-"));
const args = new Set(process.argv.slice(2));
const only = args.has("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

function slug(post, image) {
  const base = image.file.replace(/\.png$/i, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `instagram/media/${post.section}/${base}.jpg`;
}

async function upload(objectPath, bytes, contentType, cacheControl = "public, max-age=31536000") {
  const res = await fetch(`${supabase}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": contentType,
      "x-upsert": "true",
      "cache-control": cacheControl,
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Upload ${objectPath} failed: ${res.status} ${await res.text()}`);
}

async function verify(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Public URL failed: ${res.status} ${url}`);
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/jpeg")) throw new Error(`Wrong content type ${type} for ${url}`);
  return Number(res.headers.get("content-length") || 0);
}

let done = 0;
for (const post of queue.posts) {
  if (only && !`${post.section}/${post.id}`.includes(only)) continue;
  for (const image of post.images) {
    if (image.url) { done++; continue; }
    const source = path.join(repoRoot, image.local);
    if (!fs.existsSync(source)) throw new Error(`Missing source: ${source}`);
    const objectPath = slug(post, image);
    const jpg = path.join(tmp, `${done}.jpg`);
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-vf", "format=yuvj420p", "-q:v", "2", jpg], { stdio: "pipe" });
    await upload(objectPath, fs.readFileSync(jpg), "image/jpeg");
    image.url = `${supabase}/storage/v1/object/public/${bucket}/${objectPath}`;
    const bytes = await verify(image.url);
    done++;
    console.log(`${String(done).padStart(3, " ")} ${Math.round(bytes / 1024)} KB  ${image.url}`);
  }
  post.hostedAt = new Date().toISOString();
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2) + "\n");
}

const queueObject = "instagram/queue.json";

// Never clobber a queue that already has publishing history: the local file is
// the build artifact, the remote copy is the source of truth once live.
if (!args.has("--force-queue")) {
  try {
    const remote = await readQueue({ supabase, serviceKey: key });
    const touched = remote.posts?.some((post) => post.status === "published" || post.status === "error" || (post.attempts || 0) > 0);
    if (touched) {
      console.error("Remote queue already has publishing history; refusing to overwrite it with the local queue.");
      console.error("Use --force-queue only if you intend to reset the schedule from scratch.");
      process.exit(1);
    }
  } catch (error) {
    console.warn(`Could not check the remote queue (${error.message}); uploading anyway.`);
  }
}

await upload(queueObject, Buffer.from(JSON.stringify(queue, null, 2) + "\n"), "application/json", "no-cache, max-age=0");
const queueUrl = `${supabase}/storage/v1/object/public/${bucket}/${queueObject}`;
console.log(`\nQueue: ${queueUrl}`);
console.log(`Hosted ${done} images across ${queue.posts.length} posts. Queue is ${queue.paused ? "PAUSED" : "live"}.`);
