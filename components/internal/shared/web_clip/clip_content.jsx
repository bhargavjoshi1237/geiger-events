"use client";

// Renders a clip. The other half of the web-clip module's public surface — any
// feature that stores a clip renders it with this and nothing else.
//
// The clip's CSS is already scoped to its own generated class by the extractor,
// so the <style> tag here cannot leak into the host page. That scoping is the
// whole reason a clip can be dropped into an event page without a shadow root
// or an iframe.
//
// Three width strategies, because no single one is right for every component:
//
//   scale    reproduce at the captured width, then transform: scale() down.
//            Keeps the design exactly; the default.
//   stretch  let it reflow into the available width. Right for components that
//            were responsive to begin with.
//   scroll   full size with a horizontal scrollbar. Right for wide tables.
//
// Scaling measures the content's real `scrollWidth` rather than trusting the
// width recorded at capture. A component with negative margins, absolute
// positioning or a decorative overflow is wider than its own bounding box, and
// scaling by the recorded number left those edges cropped.

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { isClipFilled, normalizeClip } from "@/lib/clip/model";
import { themeAdaptCss } from "@/lib/clip/theme";

export function ClipContent({ clip, className }) {
  const data = normalizeClip(clip);
  const fallbackScope = useId().replace(/[^a-zA-Z0-9]/g, "");

  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [measured, setMeasured] = useState({ scale: 1, height: 0 });

  // Theme adaptation is a rewrite of the stored stylesheet rather than an extra
  // override sheet, so toggling it back is lossless — the stored CSS is never
  // touched.
  const css = useMemo(
    () => (data.theme === "page" ? themeAdaptCss(data.css, data.scope) : data.css),
    [data.css, data.scope, data.theme],
  );

  const natural = data.width;
  const mode = data.fit;
  const scaling = mode === "scale" && natural > 0;

  // Measured for every fixed-width mode, not just when scaling down: a crop
  // needs the rendered height even when the clip fits its column outright.
  useEffect(() => {
    if (mode === "stretch" || mode === "full") return undefined;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return undefined;

    const measure = () => {
      const available = outer.clientWidth;
      // The true painted width, which can exceed the captured bounding box.
      const content = Math.max(inner.scrollWidth, natural);
      // Only ever scale down — blowing a small component up to fill a wide
      // column looks worse than leaving it alone.
      const next =
        scaling && available > 0 && available < content ? available / content : 1;
      setMeasured({ scale: next, height: inner.scrollHeight });
    };

    // ResizeObserver fires once on observe, which covers the initial measure —
    // calling it synchronously here would be a cascading render.
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    // Late-loading images change the height after the observers first fire.
    const images = [...inner.querySelectorAll("img")];
    for (const img of images) {
      if (!img.complete) img.addEventListener("load", measure, { once: true });
    }
    return () => {
      ro.disconnect();
      for (const img of images) img.removeEventListener("load", measure);
    };
  }, [mode, scaling, natural, data.html]);

  if (!isClipFilled(data)) return null;

  // A clip saved before the scope was recorded still renders, just unscoped
  // against its own wrapper.
  const scope = data.scope || `ev-clip-${fallbackScope}`;
  const scaled = scaling && measured.scale < 1;

  // A crop only ever takes height away, so a clip that renders shorter than its
  // recorded crop is left alone rather than padded out to it.
  const cropping =
    data.height > 0 &&
    mode !== "stretch" &&
    mode !== "full" &&
    measured.height > data.height + 1;
  const boxHeight = cropping ? data.height : measured.height;

  const outerStyle = {
    ...((scaled || cropping) && boxHeight
      ? { height: boxHeight * measured.scale, overflow: "hidden" }
      : null),
    ...(mode === "scroll" ? { overflowX: "auto" } : null),
    // Full bleed: escape the content column without needing the page layout to
    // know about it. 50vw out from the container's own centre lands on the
    // viewport edge whatever the column width is.
    ...(mode === "full"
      ? {
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          maxWidth: "100vw",
        }
      : null),
    // Inline, so it beats the backdrop baked into the scoped stylesheet. Also
    // the only way to give a background to a clip captured before backdrop
    // detection existed.
    ...(data.background
      ? { backgroundColor: data.background, backgroundImage: "none" }
      : null),
  };

  const innerStyle =
    mode === "stretch" || mode === "full"
      ? { width: "100%" }
      : natural
        ? {
            width: natural,
            transform: scaled ? `scale(${measured.scale})` : undefined,
            transformOrigin: "top left",
          }
        : undefined;

  return (
    <div ref={outerRef} className={cn("ev-clip", scope, className)} style={outerStyle}>
      {css ? <style>{css}</style> : null}
      <div
        ref={innerRef}
        style={innerStyle}
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </div>
  );
}

export default ClipContent;
