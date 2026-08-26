"use client";

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

  const css = useMemo(
    () => (data.theme === "page" ? themeAdaptCss(data.css, data.scope) : data.css),
    [data.css, data.scope, data.theme],
  );

  const natural = data.width;
  const mode = data.fit;
  const scaling = mode === "scale" && natural > 0;

  useEffect(() => {
    if (mode === "stretch" || mode === "full") return undefined;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return undefined;

    const measure = () => {
      const available = outer.clientWidth;
      const content = Math.max(inner.scrollWidth, natural);
      const next =
        scaling && available > 0 && available < content ? available / content : 1;
      setMeasured({ scale: next, height: inner.scrollHeight });
    };

    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
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

  const scope = data.scope || `ev-clip-${fallbackScope}`;
  const scaled = scaling && measured.scale < 1;

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
    ...(mode === "full"
      ? {
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          maxWidth: "100vw",
        }
      : null),
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
