"use client";

// The devtools-style element picker.
//
// The page is served from our own origin by /api/clip/page and framed with
// `sandbox="allow-same-origin"` — same origin, but no allow-scripts. That pair
// is the whole trick: the parent can reach into contentDocument and drive a
// real picker against a real laid-out DOM, while none of the target site's own
// JavaScript ever executes.
//
// The highlight is drawn in the parent, positioned over the iframe, rather than
// by mutating the framed page. That keeps the target DOM pristine for
// extraction and lets the overlay carry badges and measurements the page's own
// stylesheet could otherwise fight with.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CornerUpLeft, MousePointerSquareDashed } from "lucide-react";

import { cn } from "@/lib/utils";
import { describeElement } from "@/lib/clip/extract";

// Elements too close to the whole document to be a useful "component".
const NEVER_PICK = new Set(["html", "body", "head"]);

function rectOf(el, frame) {
  const r = el.getBoundingClientRect();
  return {
    top: r.top + frame.top,
    left: r.left + frame.left,
    width: r.width,
    height: r.height,
  };
}

// The ancestor chain, outermost first, for the breadcrumb.
function ancestorsOf(el) {
  const chain = [];
  let node = el;
  while (node && node.tagName && !NEVER_PICK.has(node.tagName.toLowerCase())) {
    chain.unshift(node);
    node = node.parentElement;
  }
  return chain;
}

function statsOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    label: describeElement(el),
    width: Math.round(r.width),
    height: Math.round(r.height),
    children: el.childElementCount,
    nodes: el.querySelectorAll("*").length + 1,
    images: el.querySelectorAll("img, picture, svg").length,
    text: (el.textContent || "").trim().length,
  };
}

export function ElementPicker({ src, onPick, onLoadState }) {
  const frameRef = useRef(null);
  const wrapRef = useRef(null);

  const [hovered, setHovered] = useState(null);
  const [picked, setPicked] = useState(null);
  const [frameBox, setFrameBox] = useState({ top: 0, left: 0 });
  const [, forceTick] = useState(0);

  const repaint = useCallback(() => forceTick((n) => n + 1), []);

  // Keep the overlay aligned with the iframe as the dialog resizes or the
  // framed page scrolls.
  const syncFrameBox = useCallback(() => {
    const wrap = wrapRef.current;
    const frame = frameRef.current;
    if (!wrap || !frame) return;
    const w = wrap.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    setFrameBox({ top: f.top - w.top, left: f.left - w.left });
  }, []);

  const attach = useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc || !doc.body) {
      onLoadState?.({ status: "blocked" });
      return;
    }

    // A page that renders entirely with JavaScript arrives structurally empty.
    // Say so rather than letting the user hunt for elements that aren't there.
    const bodyText = (doc.body.textContent || "").trim();
    const nodeCount = doc.body.querySelectorAll("*").length;
    onLoadState?.({
      status: nodeCount < 8 && bodyText.length < 40 ? "empty" : "ready",
      title: doc.title || "",
      nodes: nodeCount,
    });

    const onMove = (e) => {
      const el = e.target;
      if (!el?.tagName || NEVER_PICK.has(el.tagName.toLowerCase())) return;
      setHovered(el);
    };
    const onLeave = () => setHovered(null);
    const onClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      if (!el?.tagName || NEVER_PICK.has(el.tagName.toLowerCase())) return;
      setPicked(el);
    };

    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseleave", onLeave, true);
    doc.addEventListener("click", onClick, true);
    frame.contentWindow?.addEventListener("scroll", repaint, true);
    frame.contentWindow?.addEventListener("resize", repaint);

    return () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseleave", onLeave, true);
      doc.removeEventListener("click", onClick, true);
      frame.contentWindow?.removeEventListener("scroll", repaint, true);
      frame.contentWindow?.removeEventListener("resize", repaint);
    };
  }, [onLoadState, repaint]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let detach;
    const onLoad = () => {
      syncFrameBox();
      detach = attach();
    };
    frame.addEventListener("load", onLoad);
    return () => {
      frame.removeEventListener("load", onLoad);
      detach?.();
    };
  }, [attach, syncFrameBox, src]);

  // Reset when a new page is loaded.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setHovered(null);
    setPicked(null);
  }

  useEffect(() => {
    syncFrameBox();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            syncFrameBox();
            repaint();
          })
        : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    return () => ro?.disconnect();
  }, [syncFrameBox, repaint]);

  useEffect(() => {
    onPick?.(picked);
  }, [picked, onPick]);

  // Keyboard refinement — the part that makes a picker feel like devtools
  // rather than a click target. Arrow keys walk the tree from the selection.
  useEffect(() => {
    if (!picked) return;
    const onKey = (e) => {
      let next = null;
      if (e.key === "ArrowUp") next = picked.parentElement;
      else if (e.key === "ArrowDown") next = picked.firstElementChild;
      else if (e.key === "ArrowLeft") next = picked.previousElementSibling;
      else if (e.key === "ArrowRight") next = picked.nextElementSibling;
      else if (e.key === "Escape") {
        setPicked(null);
        return;
      } else return;

      if (next?.tagName && !NEVER_PICK.has(next.tagName.toLowerCase())) {
        e.preventDefault();
        setPicked(next);
        next.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);

  const target = picked || hovered;
  const box = target ? rectOf(target, frameBox) : null;
  const stats = statsOf(target);
  const chain = picked ? ancestorsOf(picked) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden bg-white">
        <iframe
          ref={frameRef}
          src={src}
          title="Page to clip from"
          // Same origin (we proxy it) so the parent can drive the picker, but
          // no allow-scripts — the target site's JavaScript never runs.
          sandbox="allow-same-origin"
          referrerPolicy="no-referrer"
          className="h-full w-full border-0 bg-white"
        />

        {/* Highlight. pointer-events-none throughout so the iframe keeps
            receiving the mouse. */}
        {box ? (
          <div
            className={cn(
              "pointer-events-none absolute z-10 transition-[top,left,width,height] duration-75",
              picked
                ? "bg-emerald-400/15 ring-2 ring-emerald-400"
                : "bg-sky-400/15 ring-2 ring-sky-400",
            )}
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              height: box.height,
            }}
          />
        ) : null}

        {/* Devtools-style badge, flipped below the element when it would sit
            off the top edge. */}
        {box && stats ? (
          <div
            className={cn(
              "pointer-events-none absolute z-20 flex items-center gap-2 rounded-md px-2 py-1 font-mono text-[11px] leading-none shadow-lg",
              picked ? "bg-emerald-500 text-white" : "bg-sky-500 text-white",
            )}
            style={{
              top: box.top > 26 ? box.top - 26 : box.top + box.height + 6,
              left: Math.max(0, box.left),
              maxWidth: "90%",
            }}
          >
            <span className="truncate font-semibold">{stats.label}</span>
            <span className="opacity-75">
              {stats.width} × {stats.height}
            </span>
          </div>
        ) : null}

        {!target ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
            <span className="flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-xs text-white shadow-lg">
              <MousePointerSquareDashed className="h-3.5 w-3.5" />
              Hover to inspect, click to select
            </span>
          </div>
        ) : null}
      </div>

      {/* Breadcrumb + stats. Only meaningful once something is selected, but the
          row is always present so the panel doesn't jump. */}
      <div className="flex min-h-[3.25rem] shrink-0 flex-col gap-1.5 border-t border-border bg-surface-subtle px-3 py-2">
        {picked ? (
          <>
            <div className="flex items-center gap-1 overflow-x-auto">
              <CornerUpLeft className="h-3 w-3 shrink-0 text-text-tertiary" />
              {chain.map((node, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? (
                    <span className="shrink-0 text-text-tertiary">›</span>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setHovered(node)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setPicked(node)}
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors",
                      node === picked
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "text-text-secondary hover:bg-surface-active hover:text-foreground",
                    )}
                  >
                    {describeElement(node)}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
              <span>
                {stats.width} × {stats.height} px
              </span>
              <span>{stats.nodes} elements</span>
              {stats.images ? <span>{stats.images} images</span> : null}
              {stats.text ? <span>{stats.text} chars of text</span> : null}
              <span className="ml-auto hidden text-text-tertiary sm:inline">
                ↑ parent · ↓ child · ← → siblings · esc to clear
              </span>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-text-tertiary">
            Nothing selected yet. Click any part of the page to select it, then
            use the arrow keys to widen or narrow the selection.
          </p>
        )}
      </div>
    </div>
  );
}

export default ElementPicker;
