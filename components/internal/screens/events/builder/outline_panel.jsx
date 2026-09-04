"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { TreeThumb } from "../layout_thumbs";

// A thumbnail strip of the page's sections. On a long page, dragging a section
// from the bottom to the top on the canvas is a scroll-and-pray exercise; here
// it is one gesture.
export function OutlinePanel({
  tree,
  selectedId,
  accent,
  onSelect,
  onReorder,
  onToggleVisible,
}) {
  const sections = useMemo(() => tree?.sections || [], [tree]);
  const itemRefs = useRef(new Map());
  const [drag, setDrag] = useState(null);

  const start = useCallback(
    (event, index) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();

      const rects = sections.map((section) =>
        itemRefs.current.get(section.id)?.getBoundingClientRect(),
      );
      document.body.style.userSelect = "none";
      setDrag({ index, over: index });

      const onMove = (e) => {
        let over = index;
        for (let i = 0; i < rects.length; i += 1) {
          const rect = rects[i];
          if (!rect) continue;
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            over = e.clientY > rect.top + rect.height / 2 ? i + 1 : i;
            break;
          }
          if (i === rects.length - 1 && e.clientY > rect.bottom) over = rects.length;
          if (i === 0 && e.clientY < rect.top) over = 0;
        }
        setDrag((d) => (d && d.over !== over ? { ...d, over } : d));
      };

      const stop = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", cancel);
        document.body.style.userSelect = "";
        setDrag((d) => {
          if (d && d.over !== d.index && d.over !== d.index + 1) {
            onReorder(d.index, d.over);
          }
          return null;
        });
      };

      const cancel = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", cancel);
        document.body.style.userSelect = "";
        setDrag(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", cancel);
    },
    [sections, onReorder],
  );

  if (!sections.length) {
    return (
      <p className="p-4 text-xs text-text-tertiary">
        This page has no sections yet.
      </p>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <p className="px-1 pb-2 text-[0.7rem] text-text-tertiary">
        Drag a section to move it. Click to select it on the canvas.
      </p>
      <ul className="space-y-1">
        {sections.map((section, index) => (
          <li key={section.id}>
            {drag?.over === index ? (
              <div className="my-1 h-0.5 rounded-full bg-primary" />
            ) : null}
            <div
              ref={(el) => {
                if (el) itemRefs.current.set(section.id, el);
                else itemRefs.current.delete(section.id);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-1.5 transition-colors",
                selectedId === section.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-card hover:bg-surface-active",
                drag?.index === index && "opacity-40",
              )}
            >
              <span
                onPointerDown={(e) => start(e, index)}
                role="button"
                tabIndex={-1}
                aria-label={`Move ${section.name || "section"}`}
                className="cursor-grab text-text-tertiary hover:text-foreground active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </span>

              <button
                type="button"
                onClick={() => onSelect(section.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="h-9 w-14 shrink-0 overflow-hidden rounded border border-border bg-surface-subtle p-1">
                  <TreeThumb
                    tree={{ sections: [section] }}
                    accent={accent}
                    maxSections={1}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {section.name || `Section ${index + 1}`}
                  </span>
                  <span className="block text-[0.65rem] text-text-tertiary">
                    {(section.rows || []).length} row
                    {(section.rows || []).length === 1 ? "" : "s"}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onToggleVisible(section.id)}
                aria-label={section.hidden ? "Show section" : "Hide section"}
                className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-foreground"
              >
                {section.hidden ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {drag?.over === sections.length ? (
        <div className="my-1 h-0.5 rounded-full bg-primary" />
      ) : null}
    </div>
  );
}

export default OutlinePanel;
