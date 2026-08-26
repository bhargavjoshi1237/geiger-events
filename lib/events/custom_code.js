"use client";

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
    if (resource.module) script.type = "module";
    else script.async = false;
    if (resource.defer) script.defer = true;
    script.setAttribute(MARK, scope);
    script.onload = () => next(index + 1);
    script.onerror = () => next(index + 1);
    body.appendChild(script);
  };

  next(0);
}

export function useCustomCode(customCode, { doc, runScripts = true, scope = "page" } = {}) {
  const cc = normalizeCustomCode(customCode);
  const active = isCustomCodeActive(cc);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, doc, runScripts, scope]);
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, runScripts, scope, ref]);
}
