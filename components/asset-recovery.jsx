"use client";

// Recovery for the one failure a rendered page cannot report on its own: its
// JavaScript never arrives. A stale CDN copy or a half-rolled deployment answers
// a /_next/static chunk with HTML, the browser logs "Unexpected token '<'", and
// nothing hydrates — every client page then sits forever on whatever its server
// render put on screen (on /e/<id> that is "Loading Event…").
//
// The detector is an inline script on purpose: it is the only code on the page
// that still runs when every chunk is broken. It reloads once, which is all a
// stale cache needs, and if the reload lands on the same broken build it unhides
// a banner so the visitor gets a real message and a way out.

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const RETRY_KEY = "geiger:asset-retry:";

// Hidden until the inline script marks the document. A stylesheet rule rather
// than an inline `style`, so the script only has to set one attribute.
const CSS = `
#geiger-asset-error { display: none; }
html[data-asset-error="1"] #geiger-asset-error { display: flex; }
`;

const SCRIPT = `(function () {
  var PREFIX = ${JSON.stringify(`${BASE}/_next/`)};
  var RETRY_KEY = ${JSON.stringify(RETRY_KEY)};
  var store = null;
  try { store = window.sessionStorage; } catch (e) { store = null; }
  var handled = false;

  // A fresh document URL, so the reload cannot come back out of a cache holding
  // the very markup that pointed at the broken chunks.
  function bust() {
    var u = new URL(location.href);
    u.hash = "";
    u.searchParams.set("_retry", String(Date.now()));
    return u.toString();
  }

  function banner() {
    document.documentElement.setAttribute("data-asset-error", "1");
    var wire = function () {
      var link = document.querySelector("#geiger-asset-error a");
      if (link) link.setAttribute("href", bust());
      return !!link;
    };
    if (!wire()) document.addEventListener("DOMContentLoaded", wire, { once: true });
  }

  // One reload fixes the common case — a document pointing at chunks this
  // deployment no longer serves. Without sessionStorage we cannot tell a first
  // failure from a second, so we never reload: a loop is worse than the banner.
  function recover(reason) {
    if (handled) return;
    handled = true;
    console.error("[assets] " + reason);
    var mark = RETRY_KEY + location.pathname;
    if (!store || store.getItem(mark)) return banner();
    try { store.setItem(mark, "1"); } catch (e) { return banner(); }
    location.replace(bust());
  }

  function ours(url) {
    if (!url) return false;
    try { return new URL(url, location.href).pathname.indexOf(PREFIX) === 0; }
    catch (e) { return false; }
  }

  // Resource errors do not bubble, so this listener has to capture.
  window.addEventListener("error", function (ev) {
    var el = ev.target;
    if (el && el !== window && (el.tagName === "SCRIPT" || el.tagName === "LINK")) {
      var url = el.src || el.href;
      if (ours(url)) recover("failed to load " + url);
      return;
    }
    // A chunk answered with HTML loads fine and then fails to parse, arriving as
    // a plain window error carrying the chunk's URL. Only before hydration: after
    // it, the same message is far more likely to be app code parsing bad JSON.
    if (window.__geigerHydrated) return;
    if (ev.filename && ours(ev.filename) && /Unexpected token|SyntaxError/i.test(String(ev.message || ""))) {
      recover("could not parse " + ev.filename);
    }
  }, true);

  // A chunk that is never delivered fires nothing, and anything that failed
  // before this script ran was missed. Both end the same way — no hydration — so
  // fall back to watching for that. Only once the document is "complete" (async
  // chunks hold the load event open), because a slow network is not a broken
  // build and must never be answered with a reload.
  function idle() {
    if (window.__geigerHydrated) return;
    if (document.readyState !== "complete") {
      window.addEventListener("load", function () { setTimeout(idle, 4000); }, { once: true });
      return;
    }
    recover("the page never became interactive");
  }
  setTimeout(idle, 10000);
})();`;

export function AssetRecovery() {
  useEffect(() => {
    // Proof that the bundle arrived and React took over.
    window.__geigerHydrated = true;
    try {
      window.sessionStorage.removeItem(RETRY_KEY + window.location.pathname);
    } catch {
      // Storage blocked — the script already declines to reload without it.
    }
    // The reload's cache-buster has done its job; take it back out of the URL
    // rather than leaving it in the address bar and in anything the visitor
    // copies from there.
    const url = new URL(window.location.href);
    if (url.searchParams.has("_retry")) {
      url.searchParams.delete("_retry");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <div
        id="geiger-asset-error"
        role="alert"
        className="fixed inset-x-0 bottom-0 z-[100] items-center justify-center gap-3 border-t border-border bg-surface-card px-4 py-3 text-sm shadow-lg"
      >
        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-text-secondary">
          Some of this page&apos;s files couldn&apos;t be loaded, so parts of it
          may not respond.
        </span>
        <a
          href="#"
          className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground hover:bg-surface-active"
        >
          Reload
        </a>
      </div>
    </>
  );
}

export default AssetRecovery;
