"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Focus,
  Layers,
  MousePointerSquareDashed,
  Pencil,
  Scissors,
  Shrink,
  Trash2,
  Undo2,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { normalizeClip } from "@/lib/clip/model";
import {
  countTrimmableWrappers,
  describeNode,
  isolateNode,
  removeNode,
  stripPaths,
  trimWrappers,
  unwrapNode,
  withPaths,
} from "@/lib/clip/prune";
import { measureInk } from "@/lib/clip/fit";
import { ClipContent } from "./clip_content";

const MIN_RECLAIM = 24;

const MODES = [
  {
    key: "remove",
    label: "Remove",
    icon: Trash2,
    hint: "Delete the element and its contents",
    ring: "rgb(239 68 68)",
    apply: removeNode,
    blocked: "Removing that would leave the clip empty.",
  },
  {
    key: "unwrap",
    label: "Unwrap",
    icon: Layers,
    hint: "Delete the container, keep what's inside",
    ring: "rgb(168 85 247)",
    apply: unwrapNode,
    blocked: "There's nothing inside that to keep.",
  },
  {
    key: "isolate",
    label: "Keep only",
    icon: Focus,
    hint: "Discard everything except this element",
    ring: "rgb(34 197 94)",
    apply: isolateNode,
    blocked: "That's already the whole clip.",
  },
];

export function ClipPruner({ clip, onChange, className }) {
  const data = normalizeClip(clip);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState("unwrap");
  const [hovered, setHovered] = useState(null);
  const [history, setHistory] = useState([]);
  const [notice, setNotice] = useState("");
  const [ink, setInk] = useState(null);
  const hostRef = useRef(null);

  const marked = editing ? withPaths(data.html) : data.html;
  const trimmable = countTrimmableWrappers(data.html);

  useEffect(() => {
    if (!editing) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setEditing(false);
      setHovered(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const inner = hostRef.current?.querySelector(".ev-clip > div");
      setInk(measureInk(inner));
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [data.html, data.width, data.height, data.fit]);

  const active = MODES.find((m) => m.key === mode) || MODES[0];

  const wide = ink && data.width ? data.width - ink.width : 0;
  const tall = ink
    ? (data.height ? Math.min(ink.renderedHeight, data.height) : ink.renderedHeight) -
      ink.height
    : 0;
  const slack = Math.max(wide, tall);

  const frameHint =
    slack > MIN_RECLAIM
      ? "That empty space is the clip's own box, not an element — use Fit to content."
      : "The space around it is the clip's backdrop — clear it with Background → None.";

  const commit = (patch) => {
    setHistory((h) => [...h, data]);
    setHovered(null);
    setNotice("");
    onChange({ ...data, ...patch });
  };

  const pathFrom = (target) =>
    target?.closest?.("[data-ev-path]")?.getAttribute("data-ev-path") || null;

  const onClick = (e) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    const path = pathFrom(e.target);
    if (!path) {
      setNotice(frameHint);
      return;
    }
    const next = active.apply(marked, path);
    if (next) {
      commit({ html: stripPaths(next) });
      return;
    }
    setNotice(`${active.blocked} ${frameHint}`);
  };

  const trim = () => {
    const { html, removed } = trimWrappers(data.html);
    if (removed) commit({ html });
  };

  const refit = () => {
    if (slack <= MIN_RECLAIM) return;
    commit({
      width: wide > MIN_RECLAIM ? ink.width : data.width,
      height: tall > MIN_RECLAIM ? ink.height : data.height,
    });
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    onChange(previous);
  };

  const label = hovered ? describeNode(marked, hovered) : "";

  return (
    <div className={cn("space-y-2", className)}>
      {/* Edit toggle hard left, clean-up actions hard right, so the row frames
          the preview instead of clustering above its left corner. */}
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing((v) => !v);
            setHovered(null);
          }}
          title={editing ? "Done editing" : "Edit what's included"}
          aria-label={editing ? "Done editing" : "Edit what's included"}
          aria-pressed={editing}
          className={cn(editing && "border-primary bg-primary/10 text-foreground")}
        >
          {editing ? (
            <MousePointerSquareDashed className="h-3.5 w-3.5" />
          ) : (
            <Pencil className="h-3.5 w-3.5" />
          )}
        </Button>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {trimmable ? (
            <Button
              size="sm"
              variant="outline"
              onClick={trim}
              title="Strip the layout containers the component was sitting in"
            >
              <Scissors className="h-3.5 w-3.5" />
              Trim {trimmable} Wrapper{trimmable === 1 ? "" : "s"}
            </Button>
          ) : null}

          {slack > MIN_RECLAIM ? (
            <Button
              size="sm"
              variant="outline"
              onClick={refit}
              title={[
                wide > MIN_RECLAIM
                  ? `${wide}px of empty width (box ${data.width}px, design ${ink.width}px)`
                  : "",
                tall > MIN_RECLAIM ? `${tall}px of empty space below the design` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              <Shrink className="h-3.5 w-3.5" />
              Fit to content ({slack}px)
            </Button>
          ) : null}

          {history.length ? (
            <Button size="sm" variant="outline" onClick={undo}>
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {MODES.map((m) => {
              const Icon = m.icon;
              const on = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMode(m.key);
                    setNotice("");
                  }}
                  aria-pressed={on}
                  title={m.hint}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    on
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-active",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      on ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-xs font-medium leading-tight",
                        on ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {m.label}
                    </span>
                    <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                      {m.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p
            className={cn(
              "text-[11px]",
              notice ? "text-amber-400" : "truncate text-muted-foreground",
            )}
          >
            {notice ||
              (label
                ? `Click to ${active.label.toLowerCase()} — ${label}`
                : "Hover a part of the preview, then click.")}
          </p>
        </>
      ) : null}

      <div
        ref={hostRef}
        onMouseMove={(e) => {
          if (!editing) return;
          const path = pathFrom(e.target);
          setHovered(path);
          if (path) setNotice("");
        }}
        onMouseLeave={() => setHovered(null)}
        onClickCapture={onClick}
        className={cn(
          "relative rounded-lg",
          editing && "cursor-crosshair ring-1 ring-primary/40",
        )}
      >
        {editing ? (
          <style>{`
            [data-ev-path]:hover {
              outline: 2px solid ${active.ring} !important;
              outline-offset: -2px !important;
              background-color: color-mix(in srgb, ${active.ring} 12%, transparent) !important;
            }
          `}</style>
        ) : null}
        <ClipContent clip={{ ...data, html: marked }} />
      </div>
    </div>
  );
}

export default ClipPruner;
