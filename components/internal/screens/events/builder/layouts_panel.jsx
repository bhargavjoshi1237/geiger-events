"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { useOptionalProject } from "@/context/project-context";
import { PAGE_PRESETS } from "@/lib/events/page_presets";
import { listLayouts } from "@/lib/supabase/page_layouts";
import { cn } from "@/lib/utils";
import { TreeThumb } from "../layout_thumbs";

function LayoutRow({ title, subtitle, tree, accent, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-card p-2 text-left transition-colors",
        "hover:border-border-strong hover:bg-surface-active",
      )}
    >
      <span className="h-11 w-16 shrink-0 overflow-hidden rounded border border-border bg-surface-subtle p-1">
        <TreeThumb tree={tree} accent={accent} maxSections={5} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">
          {title}
        </span>
        <span className="line-clamp-2 text-[0.65rem] leading-snug text-text-tertiary">
          {subtitle}
        </span>
      </span>
    </button>
  );
}

// Swapping layout without leaving the builder. Replaces the tree outright, so it
// asks first — undo will bring the old one back either way.
export function LayoutsPanel({ accent, onApply }) {
  const project = useOptionalProject();
  const projectId = project?.projectId || null;
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(!!projectId);

  // Built once for the thumbnails; picking builds again so the applied copy
  // gets its own node ids.
  const previews = useMemo(
    () => PAGE_PRESETS.map((preset) => ({ preset, tree: preset.build() })),
    [],
  );

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    listLayouts(projectId).then((rows) => {
      if (!alive) return;
      setSaved(rows || []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const pick = (label, build) => {
    if (
      !window.confirm(
        `Replace this page with the "${label}" layout? You can undo it straight after.`,
      )
    ) {
      return;
    }
    onApply(build());
  };

  return (
    <div className="h-full space-y-4 overflow-y-auto p-2.5">
      <div className="space-y-2">
        <p className="px-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-text-tertiary">
          Presets
        </p>
        <div className="space-y-1.5">
          {previews.map(({ preset, tree }) => (
            <LayoutRow
              key={preset.key}
              title={preset.name}
              subtitle={preset.description}
              tree={tree}
              accent={accent}
              onPick={() => pick(preset.name, () => preset.build())}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-text-tertiary">
          Saved
        </p>
        {loading ? (
          <p className="flex items-center gap-2 px-0.5 text-xs text-text-tertiary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : saved.length ? (
          <div className="space-y-1.5">
            {saved.map((layout) => (
              <LayoutRow
                key={layout.id}
                title={layout.name}
                subtitle={layout.description || "Saved layout"}
                tree={layout.tree}
                accent={accent}
                onPick={() => pick(layout.name, () => layout.tree)}
              />
            ))}
          </div>
        ) : (
          <p className="px-0.5 text-[0.7rem] leading-relaxed text-text-tertiary">
            Nothing saved for this project yet. Use{" "}
            <span className="text-text-secondary">Save as layout</span> in the
            header to keep this one.
          </p>
        )}
      </div>
    </div>
  );
}

export default LayoutsPanel;
