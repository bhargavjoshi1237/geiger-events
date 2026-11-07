"use client";

import { useSyncExternalStore } from "react";

import { planShareUrl } from "@/lib/event_design";

// Small client-side helpers for collaboration: a shared ticking clock, link-token memory and the public link URL.

let now = 0;
let timer = null;
const clockListeners = new Set();

function subscribeClock(callback) {
  clockListeners.add(callback);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      clockListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    clockListeners.delete(callback);
    if (!clockListeners.size) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const readClock = () => {
  if (!now) now = Date.now();
  return now;
};
const serverClock = () => 0;

// Current time, refreshed every 30 s (0 during server render / hydration).
export const useNow = () => useSyncExternalStore(subscribeClock, readClock, serverClock);

// Link tokens are only ever returned once, so this browser remembers the ones it minted to keep "Copy link" working.
const TOKENS_KEY = "geiger.planShareTokens";

function readTokens() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TOKENS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function rememberToken(shareId, token) {
  if (!shareId || !token) return;
  try {
    window.localStorage.setItem(TOKENS_KEY, JSON.stringify({ ...readTokens(), [shareId]: token }));
  } catch {
    // Storage blocked: the link can still be reissued.
  }
}

export function recallToken(shareId) {
  if (!shareId || typeof window === "undefined") return null;
  return readTokens()[shareId] || null;
}

export function forgetToken(shareId) {
  try {
    const map = readTokens();
    delete map[shareId];
    window.localStorage.setItem(TOKENS_KEY, JSON.stringify(map));
  } catch {
    // Nothing to forget.
  }
}

export const shareLinkFor = (token) =>
  planShareUrl(`${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}`, token);

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Stops the canvas's wheel-zoom from hijacking scrolling inside a floating card (native listener — React's runs too late).
export function stopWheel(node) {
  if (!node) return undefined;
  const stop = (e) => e.stopPropagation();
  node.addEventListener("wheel", stop, { passive: true });
  return () => node.removeEventListener("wheel", stop);
}
