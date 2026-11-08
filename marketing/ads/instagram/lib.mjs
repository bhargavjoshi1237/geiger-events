// Shared helpers for the Instagram queue scripts.
// Queue state lives in Supabase Storage so publishing never touches git.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");
export const BUCKET = "content";
export const QUEUE_OBJECT = "instagram/queue.json";
export const LOCAL_QUEUE = path.join(here, "queue.json");

export function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    const p = path.join(repoRoot, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || env[m[1]] !== undefined) continue;
      env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

export function storageConfig(env) {
  const url = String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, key };
}

async function storageError(res, action) {
  const body = await res.text().catch(() => "");
  return new Error(`${action} failed: ${res.status} ${body}`.trim());
}

export async function readQueue({ supabase, serviceKey, local = false } = {}) {
  if (local) return JSON.parse(fs.readFileSync(LOCAL_QUEUE, "utf8"));
  const res = await fetch(
    `${supabase}/storage/v1/object/${BUCKET}/${QUEUE_OBJECT}?t=${Date.now()}`,
    {
      headers: {
        authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "cache-control": "no-cache",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) throw await storageError(res, "Reading queue");
  return res.json();
}

export async function writeQueue(queue, { supabase, serviceKey, local = false } = {}) {
  const body = JSON.stringify(queue, null, 2) + "\n";
  if (local) {
    fs.writeFileSync(LOCAL_QUEUE, body);
    return;
  }
  const res = await fetch(`${supabase}/storage/v1/object/${BUCKET}/${QUEUE_OBJECT}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "content-type": "application/json",
      "x-upsert": "true",
      // The queue is read on every run; never let a CDN cache a stale copy.
      "cache-control": "no-cache, max-age=0",
    },
    body,
  });
  if (!res.ok) throw await storageError(res, "Writing queue");
}

export function queueCounts(queue) {
  const counts = { queued: 0, published: 0, error: 0 };
  for (const post of queue.posts) {
    if (counts[post.status] === undefined) counts[post.status] = 0;
    counts[post.status]++;
  }
  return counts;
}

export function nextQueued(queue) {
  return queue.posts
    .filter((post) => post.status === "queued")
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0] || null;
}
