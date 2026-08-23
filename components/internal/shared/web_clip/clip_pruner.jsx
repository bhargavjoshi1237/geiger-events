"use client";

// Edit a captured clip.
//
// Three operations, and the difference between them is the whole point:
//
//   Remove   delete an element and everything inside it — the "Buy tickets"
//            button, a filter bar, a stray badge.
//   Unwrap   delete the box but keep what was in it. This is the one that
//            fixes clip quality. A picked element almost never arrives as the
//            component alone; it comes wrapped in the site's layout containers,
//            which carry that page's padding, max-width and grid rules. Those
//            wrappers are what put dead space around a clip and make it scale
//            as though it were far wider than it looks.
//   Keep only  the inverse: throw away everything except the clicked element.
//            One click instead of unwrapping four ancestors and removing six
//            siblings to get at the one card you actually wanted.
//
// "Trim wrappers" is the automated form of unwrap for the usual case, where the
// thing you wanted sits several nested layout divs down. It stops at the first
// element holding more than one child, because that is where the real component
// begins — anything past that is a judgement call and stays manual.
//
// "Fit to content" is the one thing here that isn't markup surgery. The empty
// margin around a clip is usually not an element at all — it's the clip's own
// box. Its width comes from the bounding box of the picked element, which is as
// wide as the source page's content row however narrow the design inside it is;
// its height is whatever the markup settles to once it's laid out in our page
// instead of the source page's ancestors, which is not always what it was. No
// amount of deleting reaches either, which is why it reads as a box that won't
// go away. Re-measuring what the clip actually paints is what removes it.

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

import { Button } from "@/components/ui/button";
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

// Below this there is nothing worth reclaiming, and re-fitting would just be a
// pointless undo step.
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

  // While editing, the rendered markup carries path marks. They never reach
  // storage — every write goes through stripPaths.
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

  // Measure after layout, and again whenever the markup changes — pruning is
  // usually what turns a clip's recorded width into an overstatement.
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

  // Empty margin on each axis: how much of the box the design doesn't reach.
  // Height counts against the current crop, so re-fitting settles at zero
  // instead of offering the same trim forever.
  const wide = ink && data.width ? data.width - ink.width : 0;
  const tall = ink
    ? (data.height ? Math.min(ink.renderedHeight, data.height) : ink.renderedHeight) -
      ink.height
    : 0;
  const slack = Math.max(wide, tall);

  // What to say when the space someone is trying to delete isn't an element.
  const frameHint =
    slack > MIN_RECLAIM
      ? "That empty space is the clip's own box, not an element — use Fit to content."
      : "The space around it is the clip's backdrop — clear it with Background → None.";

  // History holds whole clips, not just markup — "Fit to content" changes the
  // width, and an undo that silently skipped it would be a lie.
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
    // A click that lands on no element is on the clip's own frame — its
    // backdrop and its width, neither of which is markup.
    if (!path) {
      setNotice(frameHint);
      return;
    }
    const next = active.apply(marked, path);
    if (next) {
      commit({ html: stripPaths(next) });
      return;
    }
    // null means the operation would empty the clip, change nothing, or had
    // nothing to promote. Leave the markup alone — but say why, because a click
    // that does nothing at all reads as a broken editor, and the reason is
    // usually that the empty space they're aiming at isn't an element.
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
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing((v) => !v);
            setHovered(null);
          }}
          className={cn(
            "border-border bg-transparent",
            editing
              ? "border-primary bg-primary/10 text-foreground"
              : "text-muted-foreground hover:bg-surface-active hover:text-foreground",
          )}
        >
          {editing ? <MousePointerSquareDashed className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </Button>

        {trimmable ? (
          <Button
            size="sm"
            variant="outline"
            onClick={trim}
            title="Strip the layout containers the component was sitting in"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Scissors className="h-3.5 w-3.5" />
            Trim {trimmable} wrapper{trimmable === 1 ? "" : "s"}
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
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Shrink className="h-3.5 w-3.5" />
            Fit to content ({slack}px)
          </Button>
        ) : null}

        {history.length ? (
          <Button
            size="sm"
            variant="outline"
            onClick={undo}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </Button>
        ) : null}
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
                      on ? "text-primary" : "text-text-tertiary",
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
                    <span className="block truncate text-[10px] leading-tight text-text-tertiary">
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
              notice ? "text-amber-400" : "truncate text-text-tertiary",
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
          // Moving back onto something clickable answers the notice.
          if (path) setNotice("");
        }}
        onMouseLeave={() => setHovered(null)}
        onClickCapture={onClick}
        className={cn(
          "relative rounded-lg",
          editing && "cursor-crosshair ring-1 ring-primary/40",
        )}
      >
        {/* Outlines are drawn with CSS rather than by mutating the clip, so the
            markup being edited is exactly the markup that gets stored. */}
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
