"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Armchair, Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, SearchInput, StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import { ActionMenu, Badge, Button, LogoLoading } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import {
  createDesignObject,
  listDesignObjects,
  softDeleteDesignObject,
  updateDesignObject,
} from "@/lib/supabase/design_objects";
import { listFloorPlans } from "@/lib/supabase/floor_plans";
import { CATEGORIES, categoryLabel, formatDimensions, previewPlanFor, resolveCatalog, searchCatalog } from "@/lib/event_design";
import { cn } from "@/lib/utils";
import { ObjectDrawer } from "./object_drawer";
import { ConfirmDeleteDialog } from "./dialogs/plan_dialogs";
import { PlanRenderer } from "./plan_renderer";
import { UnitToggle } from "./fields";
import { CATEGORY_ICONS } from "./constants";

// Object Library: the standard catalog (read-only, duplicate to customise) plus the project's own objects, edited in a drawer.

const SOURCE_OPTIONS = [
  { value: "all", label: "All objects" },
  { value: "standard", label: "Standard catalog" },
  { value: "custom", label: "Custom objects" },
];

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-border-strong bg-surface-active text-foreground"
          : "border-border bg-surface-card text-text-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ObjectCard({ object, unit, usage, onOpen, actions }) {
  const preview = useMemo(() => previewPlanFor(object), [object]);
  const Icon = CATEGORY_ICONS[object.category] || Armchair;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface-subtle transition-colors hover:border-border-strong">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        aria-label={`Open ${object.name}`}
        className="block h-36 w-full cursor-pointer border-b border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <PlanRenderer plan={preview} showLabels={false} padding={0.04} className="pointer-events-none" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{object.name}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-text-secondary">
              <Icon className="h-3 w-3 shrink-0" /> {categoryLabel(object.category)}
            </p>
          </div>
          <ActionMenu label={`Actions for ${object.name}`} items={actions} />
        </div>
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs tabular-nums text-text-tertiary">
            <span>{formatDimensions(object.widthM, object.depthM, unit)}</span>
            <span className="flex items-center gap-1.5">
              {object.seats ? `${object.seats} seat${object.seats === 1 ? "" : "s"}` : "No seats"}
              {object.projectId ? <Badge variant="purple">Custom</Badge> : null}
            </span>
          </div>
          {usage ? <p className="mt-1.5 text-[11px] text-text-tertiary">On {usage} plan{usage === 1 ? "" : "s"}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function ObjectLibraryScreen() {
  const { projectId } = useProject();
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [unit, setUnit] = useState("m");
  const [drawer, setDrawer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listDesignObjects(projectId), listFloorPlans(projectId, { kind: "all" })]).then(([objects, allPlans]) => {
      if (!alive) return;
      setRows(objects ?? []);
      setPlans(allPlans ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const catalog = useMemo(() => resolveCatalog(rows), [rows]);

  // How many plans each catalog object appears on.
  const usage = useMemo(() => {
    const map = new Map();
    for (const plan of plans) {
      for (const id of new Set(plan.objects.map((o) => o.objectId).filter(Boolean))) {
        map.set(id, (map.get(id) || 0) + 1);
      }
    }
    return map;
  }, [plans]);

  const filtered = useMemo(() => searchCatalog(catalog, { query: search, category, source }), [catalog, search, category, source]);
  const counts = useMemo(() => {
    const base = searchCatalog(catalog, { query: search, source });
    const map = new Map(CATEGORIES.map((c) => [c.key, 0]));
    base.forEach((o) => map.set(o.category, (map.get(o.category) || 0) + 1));
    return { all: base.length, map };
  }, [catalog, search, source]);

  const stats = useMemo(() => {
    const custom = catalog.filter((o) => o.projectId);
    return [
      { label: "Standard", value: String(catalog.length - custom.length), footer: "Ready-made catalog" },
      { label: "Custom", value: String(custom.length), footer: "Built for this project" },
      { label: "Seat-bearing", value: String(catalog.filter((o) => o.seats > 0).length), footer: "Add to capacity" },
      { label: "In use", value: String(catalog.filter((o) => usage.has(o.id)).length), footer: "On at least one plan" },
    ];
  }, [catalog, usage]);

  const saveObject = async (input) => {
    const editing = drawer?.mode === "edit" ? drawer.object : null;
    if (editing) {
      const saved = await updateDesignObject(editing.id, input);
      if (!saved) {
        toast.error("Couldn't save the object.");
        return false;
      }
      setRows((prev) => prev.map((o) => (o.id === saved.id ? saved : o)));
      toast.success("Object saved.");
      return true;
    }
    const user = await getUser();
    const created = await createDesignObject({ ...input, id: crypto.randomUUID(), projectId, createdBy: user?.id ?? null, sortOrder: 1000 });
    if (!created) {
      toast.error("Couldn't create the object.");
      return false;
    }
    setRows((prev) => [...prev, created]);
    toast.success(`Added "${created.name}".`);
    return true;
  };

  const duplicate = async (object) => {
    const user = await getUser();
    const created = await createDesignObject({
      id: crypto.randomUUID(),
      projectId,
      createdBy: user?.id ?? null,
      name: `${object.name} (custom)`,
      category: object.category,
      shape: object.shape,
      widthM: object.widthM,
      depthM: object.depthM,
      heightM: object.heightM,
      seats: object.seats,
      chairLayout: object.chairLayout,
      description: object.description,
      sortOrder: 1000,
      config: object.config,
    });
    if (!created) {
      toast.error("Couldn't duplicate the object.");
      return;
    }
    setRows((prev) => [...prev, created]);
    setDrawer({ mode: "edit", object: created });
    toast.success("Duplicated — adjust it to suit.");
  };

  const remove = async (object) => {
    setRows((prev) => prev.filter((o) => o.id !== object.id));
    const ok = await softDeleteDesignObject(object.id);
    if (!ok) {
      setRows((prev) => [...prev, object]);
      toast.error("Couldn't delete the object.");
      return;
    }
    toast.success(`Deleted "${object.name}".`);
  };

  const actionsFor = (object) =>
    object.projectId
      ? [
          { icon: Pencil, label: "Edit", onSelect: () => setDrawer({ mode: "edit", object }) },
          { icon: Copy, label: "Duplicate", onSelect: () => duplicate(object) },
          { separator: true },
          { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setDeleteTarget(object) },
        ]
      : [
          { icon: Eye, label: "View details", onSelect: () => setDrawer({ mode: "view", object }) },
          { icon: Copy, label: "Duplicate to customise", onSelect: () => duplicate(object) },
        ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Object Library"
        description="Tables, staging, bars, AV and decor at their real sizes — the pieces every floor plan is built from."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setDrawer({ mode: "new" })}>
            <Plus className="h-4 w-4" /> New object
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex min-w-0 items-center gap-2">
          <FilterDropdown value={source} onValueChange={setSource} options={SOURCE_OPTIONS} height="h-9" />
          <UnitToggle value={unit} onChange={setUnit} />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search objects…" />
      </Toolbar>

      <div className="-mt-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          All <span className="tabular-nums text-text-tertiary">{counts.all}</span>
        </Chip>
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c.key];
          return (
            <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
              <Icon className="h-3.5 w-3.5" /> {c.label}
              <span className="tabular-nums text-text-tertiary">{counts.map.get(c.key) || 0}</span>
            </Chip>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading objects" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Armchair}
            title={source === "custom" && !search ? "No custom objects yet" : "No objects match"}
            description={
              source === "custom" && !search
                ? "Duplicate a standard object to customise it, or create one from scratch."
                : "Try another category or clear the search."
            }
            action={
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setDrawer({ mode: "new" })}>
                <Plus className="h-4 w-4" /> New object
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((object) => (
            <ObjectCard
              key={object.id}
              object={object}
              unit={unit}
              usage={usage.get(object.id) || 0}
              onOpen={() => setDrawer({ mode: object.projectId ? "edit" : "view", object })}
              actions={actionsFor(object)}
            />
          ))}
        </div>
      )}

      <ObjectDrawer
        target={drawer}
        onOpenChange={(o) => !o && setDrawer(null)}
        onSave={saveObject}
        onDuplicate={duplicate}
      />

      <ConfirmDeleteDialog
        target={deleteTarget}
        title="Delete object"
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={remove}
      >
        Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span> from the library? Plans that
        already use it keep their copies.
      </ConfirmDeleteDialog>
    </MainScreenWrapper>
  );
}

export default ObjectLibraryScreen;
