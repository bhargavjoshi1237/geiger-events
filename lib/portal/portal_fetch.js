"use client";

// Client-side fetch for the members portal.
//
// Next.js `basePath` ("/events" in production) rewrites <Link>, the router and
// static assets — but NOT fetch(). A bare fetch("/api/portal/x") therefore leaves
// this app entirely in production and lands on the suite shell, which answers
// 200 with HTML; res.json() then throws and every caller silently sees {}.
// That is what made login report "no account found" in production while working
// locally (where basePath is ""). Always reach the portal API through here.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Absolute-from-origin URL for a portal API path (pass "/api/portal/...").
export function portalUrl(path) {
  return `${BASE}${path}`;
}

export function portalFetch(path, init) {
  return fetch(portalUrl(path), init);
}

// GET JSON, or null when the request fails or isn't JSON.
export async function portalGetJson(path) {
  const res = await portalFetch(path);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// POST JSON and always resolve to { ok, data } — data is {} when the response
// isn't JSON, so a misrouted call surfaces as !ok rather than a bogus payload.
export async function portalPostJson(path, body) {
  const res = await portalFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
