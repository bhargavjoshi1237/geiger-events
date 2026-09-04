"use client";

import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Eye,
  FilePlus2,
  Loader2,
  Pencil,
  Trash2,
  Wand2,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { useOptionalProject } from "@/context/project-context";
import { PAGE_LAYOUTS } from "@/lib/events/theme";
import {
  PAGE_PRESETS,
  PRESET_CATEGORIES,
  presetsInCategory,
} from "@/lib/events/page_presets";
import {
  incrementLayoutUses,
  listLayouts,
  softDeleteLayout,
} from "@/lib/supabase/page_layouts";
import { cn } from "@/lib/utils";

import { CLASSIC_THUMBS, TreeThumb } from "./layout_thumbs";

const LayoutPreviewDialog = lazy(() =>
  import("./layout_preview").then((m) => ({ default: m.LayoutPreviewDialog })),
);

function Card({ active, thumb, title, description, tags, actions, badge }) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-3 rounded-xl border p-3 transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-surface-subtle hover:bg-surface-active",
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-surface-card p-2">
        {thumb}
        {badge ? (
          <span className="absolute right-1.5 top-1.5 rounded bg-surface-active px-1.5 py-0.5 text-[0.6rem] font-medium text-text-secondary">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {title}
          {active ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
        </p>
        <p className="text-xs leading-relaxed text-text-secondary">{description}</p>
        {tags?.length ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-border px-1.5 py-0.5 text-[0.6rem] text-text-tertiary"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
    </div>
  );
}

function Group({ title, description, children }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-text-secondary">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

export function LayoutGallery({
  design,
  theme,
  event,
  built,
  onApplyPreset,
  onApplySavedLayout,
  onApplyClassic,
  onStartBlank,
  onOpenBuilder,
}) {
  const project = useOptionalProject();
  const projectId = project?.projectId || null;

  const [filter, setFilter] = useState("all");
  const [saved, setSaved] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(!!projectId);
  const [preview, setPreview] = useState(null);

  const accent = theme?.colors?.brand || "currentColor";
  const current = design?.presetKey || null;
  const classicKey = theme?.layout || "classic";

  useEffect(() => {
    if (!projectId) return undefined;
    let live = true;
    listLayouts(projectId).then((rows) => {
      if (!live) return;
      setSaved(rows || []);
      setLoadingSaved(false);
    });
    return () => {
      live = false;
    };
  }, [projectId]);

  // Applying a layout replaces the page's structure, so anything built by hand
  // is worth one question first.
  const confirmReplace = useCallback(() => {
    if (!built) return true;
    return window.confirm(
      "Replace this page's current layout? Your event content stays — the arrangement is rebuilt.",
    );
  }, [built]);

  const applyPreset = (preset, thenEdit) => {
    if (!confirmReplace()) return;
    onApplyPreset(preset);
    toast.success(`${preset.name} applied`);
    if (thenEdit) onOpenBuilder();
  };

  const applySaved = (layout, thenEdit) => {
    if (!confirmReplace()) return;
    onApplySavedLayout(layout);
    incrementLayoutUses(layout.id, layout.uses);
    setSaved((rows) =>
      rows.map((r) => (r.id === layout.id ? { ...r, uses: (r.uses || 0) + 1 } : r)),
    );
    toast.success(`${layout.name} applied`);
    if (thenEdit) onOpenBuilder();
  };

  const removeSaved = async (layout) => {
    if (!window.confirm(`Delete the saved layout "${layout.name}"?`)) return;
    const ok = await softDeleteLayout(layout.id);
    if (!ok) {
      toast.error("Couldn't delete that layout.");
      return;
    }
    setSaved((rows) => rows.filter((r) => r.id !== layout.id));
    toast.success("Layout deleted");
  };

  // A classic layout can't render while a tree does, so this steps the page back
  // out of custom mode. The built layout is kept, not thrown away.
  const applyClassic = (key, label) => {
    if (
      built &&
      !window.confirm(
        `"${label}" replaces your built page. The built layout is kept — switching back to a preset brings it straight back. Continue?`,
      )
    ) {
      return;
    }
    onApplyClassic(key);
    toast.success(`${label} applied`);
  };

  const startBlank = () => {
    if (!confirmReplace()) return;
    onStartBlank();
    onOpenBuilder();
  };

  const chips = useMemo(
    () => [
      { key: "all", label: `All ${PAGE_PRESETS.length + PAGE_LAYOUTS.length}` },
      ...PRESET_CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
      { key: "saved", label: `My layouts${saved.length ? ` ${saved.length}` : ""}` },
      { key: "classic", label: "Classic" },
    ],
    [saved.length],
  );

  const shows = (key) => filter === "all" || filter === key;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === chip.key
                ? "border-primary bg-surface-active text-foreground"
                : "border-border text-text-secondary hover:bg-surface-active hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={startBlank}
          className="ml-auto border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <FilePlus2 className="h-4 w-4" /> Start from blank
        </Button>
      </div>

      {PRESET_CATEGORIES.filter((c) => shows(c.key)).map((category) => (
        <Group key={category.key} title={category.label} description={category.desc}>
          {presetsInCategory(category.key).map((preset) => (
            <Card
              key={preset.key}
              active={current === preset.key}
              title={preset.name}
              description={preset.description}
              tags={preset.tags}
              thumb={
                <PresetThumb preset={preset} accent={accent} />
              }
              actions={
                <>
                  <Button
                    size="sm"
                    onClick={() => applyPreset(preset, false)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Use
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => applyPreset(preset, true)}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Customize
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Preview ${preset.name}`}
                    onClick={() =>
                      setPreview({
                        name: preset.name,
                        description: preset.description,
                        tree: preset.build(),
                      })
                    }
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </>
              }
            />
          ))}
        </Group>
      ))}

      {shows("saved") ? (
        <Group
          title="My layouts"
          description={
            projectId
              ? "Arrangements saved from the page builder. Available to every event in this project."
              : "Saved layouts appear here once the page is opened inside a project."
          }
        >
          {loadingSaved ? (
            <div className="col-span-full flex items-center gap-2 rounded-xl border border-dashed border-border p-6 text-sm text-text-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your layouts…
            </div>
          ) : saved.length ? (
            saved.map((layout) => (
              <Card
                key={layout.id}
                active={current === `saved:${layout.id}`}
                title={layout.name}
                description={
                  layout.description ||
                  `Saved layout${layout.uses ? ` · used ${layout.uses}×` : ""}`
                }
                badge="Saved"
                thumb={<TreeThumb tree={layout.tree} accent={accent} />}
                actions={
                  <>
                    <Button
                      size="sm"
                      onClick={() => applySaved(layout, false)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Use
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applySaved(layout, true)}
                      className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Preview ${layout.name}`}
                      onClick={() => setPreview(layout)}
                      className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${layout.name}`}
                      onClick={() => removeSaved(layout)}
                      className="ml-auto text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                }
              />
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-tertiary">
              Nothing saved yet. Open the builder, arrange a page, then use{" "}
              <span className="text-text-secondary">Save as layout</span> to keep it.
            </div>
          )}
        </Group>
      ) : null}

      {shows("classic") ? (
        <Group
          title="Classic layouts"
          description="The original fixed layouts. They apply instantly and take your theme, but they can't be edited block by block — use a preset for that."
        >
          {PAGE_LAYOUTS.map((layout) => {
            const Thumb = CLASSIC_THUMBS[layout.key];
            return (
              <Card
                key={layout.key}
                active={!built && classicKey === layout.key}
                title={layout.label}
                description={layout.desc}
                thumb={Thumb ? <Thumb /> : null}
                actions={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => applyClassic(layout.key, layout.label)}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    Use
                  </Button>
                }
              />
            );
          })}
        </Group>
      ) : null}

      {preview ? (
        <Suspense fallback={null}>
          <LayoutPreviewDialog
            open
            onOpenChange={(open) => !open && setPreview(null)}
            layout={preview}
            event={event}
            theme={theme}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

// Presets are functions, not stored trees — build once for the thumbnail rather
// than on every render.
function PresetThumb({ preset, accent }) {
  const tree = useMemo(() => preset.build(), [preset]);
  return <TreeThumb tree={tree} accent={accent} />;
}

export default LayoutGallery;
