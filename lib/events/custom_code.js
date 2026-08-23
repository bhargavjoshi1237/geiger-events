"use client";

// Custom CSS / JS / external resources for a built page.
//
// This is deliberately unsanitised: the organizer is the authenticated author of
// their own public page, and stripping <script> or rewriting attributes would
// break the exact thing it exists for — pasted third-party widgets and the
// author's own classes and functions. It is gated on the `events.page.customcode`
// permission plus a one-time acknowledgement stored on the design.
//
// Two execution contexts, deliberately different:
//   published page  — CSS and JS both run, JS after the DOM exists
//   builder canvas  — CSS runs (so custom classes are visible while designing),
//                     JS never does (a bad script must not take the editor down)

import { useEffect } from "react";

export const DEFAULT_CUSTOM_CODE = {
  enabled: false,
  acknowledged: false,
  css: "",
  js: "",
  resources: [],
};

export function normalizeCustomCode(value) {
  const cc = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_CUSTOM_CODE,
    ...cc,
    resources: Array.isArray(cc.resources) ? cc.resources : [],
  };
}

/** True when there is something to inject and the author has switched it on. */
export function isCustomCodeActive(customCode) {
  const cc = normalizeCustomCode(customCode);
  if (!cc.enabled) return false;
  return !!(cc.css.trim() || cc.js.trim() || cc.resources.some((r) => r?.url));
}

function resourcesOf(customCode, kind) {
  return normalizeCustomCode(customCode)
    .resources.filter((r) => r?.url && (r.kind || "js") === kind)
    .map((r) => ({ ...r, url: String(r.url).trim() }));
}

/**
 * A syntax check for the JS editor. Parses without executing, so the author
 * sees a typo in the dialog instead of in their visitors' consoles.
 */
export function checkJs(source) {
  const text = String(source || "").trim();
  if (!text) return { ok: true, message: "" };
  try {
    new Function(text);
    return { ok: true, message: "" };
  } catch (err) {
    return { ok: false, message: err?.message || "Syntax error" };
  }
}

// Everything injected carries this attribute so a re-run can find and remove
// exactly its own nodes, and nothing else on the page.
const MARK = "data-ev-custom";

export function clear(doc, scope) {
  if (!doc) return;
  doc.querySelectorAll(`[${MARK}="${scope}"]`).forEach((el) => el.remove());
}

export function injectStyles(doc, customCode, scope) {
  const cc = normalizeCustomCode(customCode);
  const head = doc.head || doc.documentElement;

  for (const resource of resourcesOf(cc, "css")) {
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = resource.url;
    link.setAttribute(MARK, scope);
    head.appendChild(link);
  }

  if (cc.css.trim()) {
    const style = doc.createElement("style");
    style.textContent = cc.css;
    style.setAttribute(MARK, scope);
    head.appendChild(style);
  }
}

/**
 * Load external scripts in order, then the inline script. Sequential because a
 * pasted widget's inline initialiser almost always depends on the library tag
 * above it having finished loading.
 */
export function injectScripts(doc, customCode, scope, cancelled) {
  const cc = normalizeCustomCode(customCode);
  const body = doc.body || doc.documentElement;
  const externals = resourcesOf(cc, "js");

  const runInline = () => {
    if (cancelled.current || !cc.js.trim()) return;
    const script = doc.createElement("script");
    script.textContent = cc.js;
    script.setAttribute(MARK, scope);
    body.appendChild(script);
  };

  const next = (index) => {
    if (cancelled.current) return;
    if (index >= externals.length) {
      runInline();
      return;
    }
    const resource = externals[index];
    const script = doc.createElement("script");
    script.src = resource.url;
    // Module scripts are deferred by the browser and may carry imports, so never
    // force them synchronous; classic scripts load in order instead.
    if (resource.module) script.type = "module";
    else script.async = false;
    if (resource.defer) script.defer = true;
    script.setAttribute(MARK, scope);
    // A broken CDN URL must not stall the rest of the chain.
    script.onload = () => next(index + 1);
    script.onerror = () => next(index + 1);
    body.appendChild(script);
  };

  next(0);
}

/**
 * Inject a page's custom code into `doc`.
 *
 * @param customCode the design's customCode bag
 * @param options.doc target document (the iframe's, in the builder canvas)
 * @param options.runScripts false in the canvas, true on the published page
 * @param options.scope marker value, so canvas and page never clear each other
 */
export function useCustomCode(customCode, { doc, runScripts = true, scope = "page" } = {}) {
  const cc = normalizeCustomCode(customCode);
  const active = isCustomCodeActive(cc);
  // Serialised so the effect re-runs on an actual content change, not on every
  // render that happens to rebuild the object.
  const signature = active
    ? JSON.stringify([cc.css, runScripts ? cc.js : "", cc.resources])
    : "";

  useEffect(() => {
    const target = doc || (typeof document !== "undefined" ? document : null);
    if (!target || !signature) return undefined;

    const cancelled = { current: false };
    clear(target, scope);
    injectStyles(target, cc, scope);
    if (runScripts) injectScripts(target, cc, scope, cancelled);

    return () => {
      cancelled.current = true;
      clear(target, scope);
    };
    // `signature` stands in for the custom-code content; `cc` is rebuilt each
    // render and would otherwise re-inject (and re-run) on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, doc, runScripts, scope]);
}

/**
 * Inject a bare list of external `{ kind, url }` resources into the document a
 * live DOM node authored. Used by the Raw HTML block for assets extracted from
 * the page the markup was cloned from, so the pasted content renders styled.
 *
 * Styles load in every context (they are what make the block look right while
 * designing); scripts load only when `runScripts` is true, so a bad snippet
 * can't take the builder canvas down.
 *
 * @param ref   a ref whose current element's `ownerDocument` is the target
 * @param assets  `[{ kind: "css" | "js", url }]`, as returned /api/clone-assets
 * @param options.runScripts  true on the published page, false in the canvas
 * @param options.scope  marker value so canvas and page never clear each other
 */
export function useExternalResources(ref, assets, { runScripts = true, scope = "block" } = {}) {
  const list = (Array.isArray(assets) ? assets : []).filter((r) => r?.url);
  const signature = JSON.stringify(list.map((r) => [r.kind, r.url]));

  useEffect(() => {
    const doc = ref?.current?.ownerDocument ||
      (typeof document !== "undefined" ? document : null);
    if (!doc) return undefined;

    const cancelled = { current: false };
    clear(doc, scope);
    if (signature) {
      const bag = { resources: list };
      injectStyles(doc, bag, scope);
      if (runScripts) injectScripts(doc, bag, scope, cancelled);
    }
    return () => {
      cancelled.current = true;
      clear(doc, scope);
    };
    // `signature` stands in for the asset list; `list` would change identity on
    // every render and re-inject unnecessarily. `ref` is a stable ref object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, runScripts, scope, ref]);
}
