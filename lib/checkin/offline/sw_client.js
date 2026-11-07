"use client";

import { useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const SW_URL = `${BASE}/checkin/sw.js`;

// Production only; in dev Turbopack chunks aren't immutable, so opt in with localStorage "checkin:sw" = "on".
function swEnabled() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (process.env.NODE_ENV === "production") return true;
  try {
    return localStorage.getItem("checkin:sw") === "on";
  } catch {
    return false;
  }
}

// Build assets this page already loaded (before the worker controlled it), for the worker to cache.
function loadedAssets() {
  const prefix = `${BASE}/_next/static/`;
  const out = new Set();
  const add = (href) => {
    try {
      const url = new URL(href, window.location.href);
      if (url.origin === window.location.origin && url.pathname.startsWith(prefix)) out.add(url.pathname + url.search);
    } catch {
    }
  };
  for (const entry of performance.getEntriesByType?.("resource") || []) add(entry.name);
  document.querySelectorAll("script[src]").forEach((el) => add(el.getAttribute("src")));
  document.querySelectorAll("link[href]").forEach((el) => add(el.getAttribute("href")));
  return [...out];
}

// Registers the check-in service worker for one staff route ("checkin" | "door" | "kiosk") so it loads with no connection.
export function useCheckinServiceWorker(route) {
  useEffect(() => {
    if (!swEnabled()) {
      if (typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistrations) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.filter((r) => (r.active?.scriptURL || "").endsWith("/checkin/sw.js")).forEach((r) => r.unregister()))
          .catch(() => {});
      }
      return undefined;
    }
    let cancelled = false;
    const warm = (worker) => {
      if (cancelled || !worker) return;
      worker.postMessage({ type: "checkin-sw-warm", page: window.location.pathname, assets: loadedAssets() });
    };
    const onMessage = (e) => {
      if (e.data?.type === "checkin-sw-activated") navigator.serviceWorker.ready.then((reg) => warm(reg.active)).catch(() => {});
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker
      .register(SW_URL, { scope: `${BASE}/${route}/` })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => warm(reg.active))
      .catch((e) => console.error("[checkin.sw]", e));
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [route]);
}

export default useCheckinServiceWorker;
