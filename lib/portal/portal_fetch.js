"use client";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function portalUrl(path) {
  return `${BASE}${path}`;
}

export function portalFetch(path, init) {
  return fetch(portalUrl(path), init);
}

export async function portalGetJson(path) {
  const res = await portalFetch(path);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function portalPostJson(path, body) {
  const res = await portalFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
