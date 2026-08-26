"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const SRC_DOC = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>`;

function mirrorStyles(doc) {
  const head = doc.head;
  const sync = () => {
    head.querySelectorAll("[data-ev-mirrored]").forEach((el) => el.remove());
    document
      .querySelectorAll('link[rel="stylesheet"], style')
      .forEach((node) => {
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

const CANVAS_CSS = `
  html,body{margin:0;padding:0;background:transparent;}
  body{min-height:100%;}
  ::-webkit-scrollbar{width:10px;height:10px}
  ::-webkit-scrollbar-thumb{background:var(--surface-active);border-radius:8px}
`;

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
