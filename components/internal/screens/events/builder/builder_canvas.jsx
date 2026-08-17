"use client";

// The builder canvas: an iframe with the page portalled into it.
//
// It is an iframe because a device toggle has to change a real viewport. CSS
// media queries — the page's own compiled breakpoints, Tailwind's, and any the
// author writes in custom CSS — key off the viewport, so a scaled <div> would
// preview desktop rules at phone width and quietly lie.
//
// It is a *portal*, not a separate app: the tree renders inside the iframe's
// document but stays in this React tree, in this JS context. No message
// protocol, no serialisation, and event handlers work exactly as they would
// anywhere else.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const SRC_DOC = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>`;

// The app's own stylesheet has to come along — every component is built from
// Tailwind utilities and the theme's CSS variables. In dev those arrive as
// <style> tags and move on hot reload, so we mirror head rather than copy once.
function mirrorStyles(doc) {
  const head = doc.head;
  const sync = () => {
    head.querySelectorAll("[data-ev-mirrored]").forEach((el) => el.remove());
    document
      .querySelectorAll('link[rel="stylesheet"], style')
      .forEach((node) => {
        // Skip anything the page itself injected into the iframe (custom CSS,
        // compiled node styles) — those are owned elsewhere.
        if (node.hasAttribute("data-ev-custom")) return;
        const copy = node.cloneNode(true);
        copy.setAttribute("data-ev-mirrored", "");
        head.appendChild(copy);
      });
  };

  sync();
  const observer = new MutationObserver(sync);
  observer.observe(document.head, { childList: true });
  return () => observer.disconnect();
}

// Base rules for the canvas document itself. The body has to be transparent and
// unpadded so what shows through is the page, not a browser default.
const CANVAS_CSS = `
  html,body{margin:0;padding:0;background:transparent;}
  body{min-height:100%;}
  ::-webkit-scrollbar{width:10px;height:10px}
  ::-webkit-scrollbar-thumb{background:var(--surface-active);border-radius:8px}
`;

/**
 * @param width     device width in px (the iframe's real width)
 * @param zoom      display scale; the iframe still lays out at `width`
 * @param onDocument called with the iframe document once it is ready
 * @param frameRef  ref that receives the iframe element
 */
export function BuilderCanvas({
  width,
  zoom = 1,
  className,
  bodyClassName,
  bodyStyle,
  frameRef,
  onDocument,
  children,
}) {
  const [doc, setDoc] = useState(null);

  // A ref callback rather than an effect: the iframe may already be loaded by
  // the time React attaches, and this is the one place both cases are visible.
  const attach = useCallback(
    (el) => {
      if (frameRef) frameRef.current = el;
      if (!el) {
        setDoc(null);
        return;
      }
      const ready = () => setDoc(el.contentDocument || null);
      if (el.contentDocument?.readyState === "complete") ready();
      el.addEventListener("load", ready);
    },
    [frameRef],
  );

  useEffect(() => {
    if (!doc) return undefined;
    const style = doc.createElement("style");
    style.textContent = CANVAS_CSS;
    doc.head.appendChild(style);
    const stop = mirrorStyles(doc);
    return () => {
      stop();
      style.remove();
    };
  }, [doc]);

  useEffect(() => {
    if (doc && onDocument) onDocument(doc);
  }, [doc, onDocument]);

  // The iframe is laid out at its true device width and then scaled, so its
  // media queries see `width` while the pane shows it at `width * zoom`.
  const frameStyle = useMemo(
    () => ({
      width,
      height: zoom === 1 ? "100%" : `${100 / zoom}%`,
      transform: zoom === 1 ? undefined : `scale(${zoom})`,
      transformOrigin: "top center",
    }),
    [width, zoom],
  );

  return (
    <div
      className={cn("flex justify-center overflow-auto", className)}
      style={{ width: "100%" }}
    >
      <div style={{ width: width * zoom, maxWidth: "100%", height: "100%" }}>
        <iframe
          ref={attach}
          title="Page canvas"
          srcDoc={SRC_DOC}
          style={frameStyle}
          className="block border-0 bg-transparent"
        />
        {doc
          ? createPortal(
              <div className={bodyClassName} style={bodyStyle}>
                {children}
              </div>,
              doc.body,
            )
          : null}
      </div>
    </div>
  );
}

export default BuilderCanvas;
