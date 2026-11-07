// Source of the staff-route service worker, served from <base>/checkin/sw.js (app/checkin/sw.js/route.js) so it lives
// under a path the suite gate already leaves public. It caches only the staff route HTML and Next's hashed static assets;
// API routes, RSC payloads, cross-origin calls (Supabase) and every other page always go to the network untouched.

// Bump when the worker's logic changes; caches are kept across versions because their contents are versioned by URL.
export const CHECKIN_SW_VERSION = "1";

export function checkinServiceWorkerSource(base = "") {
  return `/* Geiger check-in service worker v${CHECKIN_SW_VERSION} */
const BASE = ${JSON.stringify(base)};
const PAGES = "geiger-checkin-pages";
const ASSETS = "geiger-checkin-assets";
const KEEP = [PAGES, ASSETS];
const MAX_ASSETS = 400;
const NAV_TIMEOUT_MS = 4000;
const STAFF = ["/checkin/", "/door/", "/kiosk/"].map((p) => BASE + p);

const isStaffPage = (url) => STAFF.some((p) => url.pathname.startsWith(p)) && !url.pathname.endsWith("/sw.js");
const isAsset = (url) => url.pathname.startsWith(BASE + "/_next/static/") || url.pathname === BASE + "/favicon.ico";
const pageKey = (url) => url.origin + url.pathname;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("geiger-checkin-") && !KEEP.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: "window" });
    windows.forEach((c) => c.postMessage({ type: "checkin-sw-activated" }));
  })());
});

async function cachePage(url, response) {
  if (!response || !response.ok || response.redirected || response.type !== "basic") return;
  if (!(response.headers.get("content-type") || "").includes("text/html")) return;
  const cache = await caches.open(PAGES);
  await cache.put(pageKey(url), response);
}

async function cacheAsset(href, response) {
  if (!response || !response.ok || response.type !== "basic") return;
  const cache = await caches.open(ASSETS);
  await cache.put(href, response);
}

async function trimAssets(keep) {
  const cache = await caches.open(ASSETS);
  const keys = await cache.keys();
  let excess = keys.length - MAX_ASSETS;
  for (const req of keys) {
    if (excess <= 0) break;
    if (keep.has(req.url)) continue;
    await cache.delete(req);
    excess -= 1;
  }
}

function offlinePage() {
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:15px/1.5 system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;padding:24px;text-align:center}' +
    'p{max-width:340px;color:#a3a3a3}h1{font-size:18px;margin:0 0 8px;color:#fafafa}</style></head><body><div><h1>You\\'re offline</h1>' +
    '<p>This check-in page hasn\\'t been opened on this device yet. Open it once while connected and it will keep working without signal.</p></div></body></html>';
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// Network first so a new deployment is picked up at once; the cached shell answers when the network fails or stalls.
async function navigate(request, url) {
  const cache = await caches.open(PAGES);
  const cached = await cache.match(pageKey(url), { ignoreVary: true, ignoreSearch: true });
  const network = fetch(request).then((res) => {
    cachePage(url, res.clone()).catch(() => {});
    return res;
  });
  if (!cached) return network.catch(() => offlinePage());
  network.catch(() => {});
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS));
  try {
    return (await Promise.race([network, timeout])) || cached;
  } catch {
    return cached;
  }
}

// Hashed build assets never change at a URL, so cache first.
async function asset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  cacheAsset(request.url, res.clone()).catch(() => {});
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(BASE + "/api/")) return;
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;
  if (request.mode === "navigate") {
    if (isStaffPage(url)) event.respondWith(navigate(request, url));
    return;
  }
  if (isAsset(url)) event.respondWith(asset(request));
});

// The page lists what it loaded before this worker controlled it, so the first online visit is enough to work offline.
async function warm(data) {
  const tasks = [];
  if (typeof data.page === "string") {
    const url = new URL(data.page, self.location.origin);
    if (url.origin === self.location.origin && isStaffPage(url)) {
      tasks.push(fetch(url.origin + url.pathname, { credentials: "same-origin" }).then((res) => cachePage(url, res)).catch(() => {}));
    }
  }
  const cache = await caches.open(ASSETS);
  const keep = new Set();
  for (const href of (Array.isArray(data.assets) ? data.assets : []).slice(0, 300)) {
    const url = new URL(href, self.location.origin);
    if (url.origin !== self.location.origin || !isAsset(url)) continue;
    keep.add(url.href);
    tasks.push(cache.match(url.href).then((hit) => hit || fetch(url.href, { credentials: "same-origin" }).then((res) => cacheAsset(url.href, res))).catch(() => {}));
  }
  await Promise.all(tasks);
  await trimAssets(keep);
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "checkin-sw-warm") event.waitUntil(warm(event.data));
});
`;
}
