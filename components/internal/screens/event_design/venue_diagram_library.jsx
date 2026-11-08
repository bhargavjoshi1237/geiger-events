"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, CalendarPlus, Copy, DoorOpen, Library, Plus, SquarePen, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, SearchInput, Toolbar } from "@/components/internal/shared/screen_kit";
import { ActionMenu, Button, LogoLoading } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import { copyFloorPlan, listFloorPlans, softDeleteFloorPlan } from "@/lib/supabase/floor_plans";
import { formatDimensions, planSummary, SETUP_STYLES, setupStyleLabel } from "@/lib/event_design";
import { FloorPlanEditor } from "./editor/plan_editor";
import { NewPlanDialog } from "./dialogs/new_plan_dialog";
import { NewSpaceDialog } from "./dialogs/space_picker";
import { ConfirmDeleteDialog } from "./dialogs/plan_dialogs";
import { PlanRenderer } from "./plan_renderer";
import { createPlanFrom } from "./create_plan";
import { useDesignContext } from "./use_design_context";
import { SETUP_STYLE_FILTER_OPTIONS } from "./constants";

// Venue Diagram Library: each room's standard layouts (floor_plans kind "library"), grouped venue → room, copied into event plans on demand.

const STYLE_ORDER = new Map(SETUP_STYLES.map((s, i) => [s.value, i]));
const outline = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

const byStyleThenName = (a, b) =>
  (STYLE_ORDER.get(a.setupStyle) ?? 99) - (STYLE_ORDER.get(b.setupStyle) ?? 99) ||
  (a.name || "").localeCompare(b.name || "");

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function DiagramTile({ diagram, onOpen, actions }) {
  const summary = useMemo(() => planSummary(diagram), [diagram]);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-card transition-colors hover:border-border-strong">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${diagram.name || "diagram"}`}
        className="relative block h-28 w-full border-b border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <PlanRenderer plan={diagram} showLabels={false} padding={0.08} className="pointer-events-none" />
      </button>
      <div className="flex items-start gap-1 py-2 pl-3 pr-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{diagram.name || "Untitled diagram"}</p>
          <p className="truncate text-xs text-text-tertiary">
            {setupStyleLabel(diagram.setupStyle)} · {plural(summary.seats, "seat")}
          </p>
        </div>
        <ActionMenu label={`Actions for ${diagram.name || "diagram"}`} items={actions} />
      </div>
    </div>
  );
}

function RoomRow({ space, diagrams, onNew, renderTile }) {
  const meta = [
    space.widthM && space.lengthM ? formatDimensions(space.widthM, space.lengthM, space.unit) : null,
    space.floor || null,
    plural(diagrams.length, "layout"),
  ].filter(Boolean);
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{space.name || "Untitled room"}</p>
          <p className="truncate text-xs text-text-secondary">{meta.join(" · ")}</p>
        </div>
        <Button variant="outline" size="sm" className={`h-8 shrink-0 ${outline}`} onClick={onNew}>
          <Plus className="h-3.5 w-3.5" /> New layout
        </Button>
      </div>
      {diagrams.length ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {diagrams.map(renderTile)}
        </div>
      ) : (
        <p className="mt-2 text-xs text-text-tertiary">No standard layouts for this room yet.</p>
      )}
    </div>
  );
}

export function VenueDiagramLibraryScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const ctx = useDesignContext(projectId);
  const [diagrams, setDiagrams] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [venueFilter, setVenueFilter] = useState("all");
  const [style, setStyle] = useState("all");
  const [search, setSearch] = useState("");
  const [newFor, setNewFor] = useState(null);
  const [spaceFor, setSpaceFor] = useState(null);
  const [useTarget, setUseTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listFloorPlans(projectId, { kind: "library" }), listFloorPlans(projectId, { kind: "template" })]).then(
      ([rows, tmpl]) => {
        if (!alive) return;
        setDiagrams(rows ?? []);
        setTemplates(tmpl ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtering = style !== "all" || Boolean(search.trim());

  // Venue → rooms → matching diagrams; while filtering, rooms (and venues) with no match drop out.
  const { groups, unfiled, roomless, shownCount } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (d) =>
      (style === "all" || d.setupStyle === style) && (!q || `${d.name} ${d.notes}`.toLowerCase().includes(q));

    const bySpace = new Map();
    const loose = [];
    for (const d of diagrams) {
      if (!matches(d)) continue;
      if (d.venueSpaceId && ctx.spaceById.has(d.venueSpaceId)) {
        if (!bySpace.has(d.venueSpaceId)) bySpace.set(d.venueSpaceId, []);
        bySpace.get(d.venueSpaceId).push(d);
      } else {
        loose.push(d);
      }
    }

    const out = [];
    let count = 0;
    for (const venue of ctx.venues) {
      if (venueFilter !== "all" && venue.id !== venueFilter) continue;
      const rooms = ctx.spaces
        .filter((s) => s.venueId === venue.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || (a.name || "").localeCompare(b.name || ""))
        .map((space) => ({ space, diagrams: (bySpace.get(space.id) || []).sort(byStyleThenName) }))
        .filter((room) => !filtering || room.diagrams.length);
      if (!rooms.length) continue;
      count += rooms.reduce((n, r) => n + r.diagrams.length, 0);
      out.push({ venue, rooms });
    }
    const showLoose = venueFilter === "all" ? loose.sort(byStyleThenName) : [];
    return {
      groups: out,
      unfiled: showLoose,
      roomless: ctx.venues.filter((v) => !ctx.spaces.some((s) => s.venueId === v.id)),
      shownCount: count + showLoose.length,
    };
  }, [diagrams, ctx.venues, ctx.spaces, ctx.spaceById, venueFilter, style, search, filtering]);

  const venueOptions = useMemo(
    () => [
      { value: "all", label: "All venues" },
      ...ctx.venues
        .filter((v) => ctx.spaces.some((s) => s.venueId === v.id))
        .map((v) => ({ value: v.id, label: v.name || "Untitled venue" })),
    ],
    [ctx.venues, ctx.spaces],
  );

  const createDiagram = async (input) => {
    const created = await createPlanFrom(input, { projectId, kind: "library" });
    if (!created) {
      toast.error("Couldn't create the diagram.");
      return false;
    }
    setDiagrams((prev) => [created, ...prev]);
    toast.success("Diagram created — lay it out.");
    openRecord(created.id);
    return true;
  };

  const copyToEvent = async (input) => {
    const created = await createPlanFrom(input, { projectId, kind: "plan" });
    if (!created) {
      toast.error("Couldn't create the plan.");
      return false;
    }
    toast.success(`Plan created for ${ctx.eventById.get(created.eventId)?.name || "the event"} — it's in Floor Plans.`);
    openRecord(created.id);
    return true;
  };

  const duplicate = async (d) => {
    const user = await getUser();
    const copy = await copyFloorPlan(d, { name: `${d.name} (copy)`, kind: "library", createdBy: user?.id ?? null });
    if (!copy) {
      toast.error("Couldn't duplicate the diagram.");
      return;
    }
    setDiagrams((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${d.name}".`);
  };

  const remove = async (d) => {
    setDiagrams((prev) => prev.filter((x) => x.id !== d.id));
    const ok = await softDeleteFloorPlan(d.id);
    if (!ok) {
      setDiagrams((prev) => [d, ...prev]);
      toast.error("Couldn't delete the diagram.");
      return;
    }
    toast.success(`Deleted "${d.name}".`);
  };

  if (recordId) {
    return (
      <FloorPlanEditor
        planId={recordId}
        onBack={closeRecord}
        backLabel="Venue Diagram Library"
        onSaved={(p) => p.kind === "library" && setDiagrams((prev) => prev.map((d) => (d.id === p.id ? p : d)))}
      />
    );
  }

  const openNew = (initial) => (ctx.spaces.length ? setNewFor(initial) : setSpaceFor({ venueId: initial.venueId ?? null }));

  const renderTile = (d) => (
    <DiagramTile
      key={d.id}
      diagram={d}
      onOpen={() => openRecord(d.id)}
      actions={[
        { icon: CalendarPlus, label: "Use for event", disabled: !ctx.events.length, onSelect: () => setUseTarget(d) },
        { icon: SquarePen, label: "Edit layout", onSelect: () => openRecord(d.id) },
        { icon: Copy, label: "Duplicate", onSelect: () => duplicate(d) },
        { separator: true },
        { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setDeleteTarget(d) },
      ]}
    />
  );

  const roomlessNames = roomless.map((v) => v.name || "Untitled venue");
  const roomlessLabel =
    roomlessNames.length > 2
      ? `${roomlessNames.slice(0, 2).join(", ")} and ${roomlessNames.length - 2} more`
      : roomlessNames.join(" and ");

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Venue Diagram Library"
        description="Each room's standard layouts — theatre, banquet, reception — kept on file and copied into an event's plan in one step."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!ctx.venues.length}
            onClick={() => openNew({ source: "space", venueId: venueFilter !== "all" ? venueFilter : null })}
          >
            <Plus className="h-4 w-4" /> New diagram
          </Button>
        }
      />

      {loading || ctx.loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading the diagram library" />
        </div>
      ) : !ctx.venues.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Building2}
            title="No venues yet"
            description="Add a venue under Venues first — diagrams are filed against its rooms."
          />
        </div>
      ) : !ctx.spaces.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={DoorOpen}
            title="No rooms yet"
            description="Add a room to one of your venues, then file its standard layouts here."
            action={
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setSpaceFor({ venueId: null })}>
                <Plus className="h-4 w-4" /> Add room
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <Toolbar>
            <div className="flex flex-wrap items-center gap-2">
              <FilterDropdown value={venueFilter} onValueChange={setVenueFilter} options={venueOptions} height="h-9" />
              <FilterDropdown value={style} onValueChange={setStyle} options={SETUP_STYLE_FILTER_OPTIONS} height="h-9" />
              <span className="text-xs tabular-nums text-text-tertiary">{plural(shownCount, "layout")}</span>
            </div>
            <SearchInput value={search} onChange={setSearch} placeholder="Search diagrams…" />
          </Toolbar>

          {groups.length || unfiled.length ? (
            <div className="space-y-8">
              {groups.map(({ venue, rooms }) => (
                <section key={venue.id} className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-foreground">{venue.name || "Untitled venue"}</h2>
                      <p className="text-xs text-text-tertiary">
                        {[venue.city, plural(rooms.length, "room")].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      onClick={() => setSpaceFor({ venueId: venue.id })}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add room
                    </Button>
                  </div>
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-subtle">
                    {rooms.map(({ space, diagrams: list }) => (
                      <RoomRow
                        key={space.id}
                        space={space}
                        diagrams={list}
                        renderTile={renderTile}
                        onNew={() => openNew({ source: "space", venueId: venue.id, spaceId: space.id })}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {unfiled.length ? (
                <section className="space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Not filed to a room</h2>
                    <p className="text-xs text-text-tertiary">Their room was removed — open one to link it to another room.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-subtle p-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                    {unfiled.map(renderTile)}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Library}
                title="No diagrams match"
                description="Try another venue, setup style or search."
              />
            </div>
          )}

          {roomless.length && venueFilter === "all" && !filtering ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
              <p className="min-w-0 text-sm text-text-secondary">
                {roomlessLabel} {roomless.length === 1 ? "has" : "have"} no rooms yet — add one to file its layouts.
              </p>
              <Button variant="outline" size="sm" className={`h-8 ${outline}`} onClick={() => setSpaceFor({ venueId: roomless[0].id })}>
                <Plus className="h-3.5 w-3.5" /> Add room
              </Button>
            </div>
          ) : null}
        </>
      )}

      <NewPlanDialog
        open={!!newFor}
        onOpenChange={(o) => !o && setNewFor(null)}
        ctx={ctx}
        projectId={projectId}
        templates={templates}
        kind="library"
        requireSpace
        initial={newFor || {}}
        title="New venue diagram"
        description="A standard layout for one of the venue's rooms, drawn at the room's real size."
        submitLabel="Create diagram"
        onCreate={createDiagram}
      />

      <NewPlanDialog
        open={!!useTarget}
        onOpenChange={(o) => !o && setUseTarget(null)}
        ctx={ctx}
        projectId={projectId}
        initial={{ source: "library", sourcePlan: useTarget, name: useTarget?.name }}
        requireEvent
        title="Use for an event"
        description="Copies this diagram into a new floor plan for the event — the library original stays untouched."
        submitLabel="Create plan"
        onCreate={copyToEvent}
      />

      <NewSpaceDialog
        open={!!spaceFor}
        onOpenChange={(o) => !o && setSpaceFor(null)}
        projectId={projectId}
        venues={ctx.venues}
        defaultVenueId={spaceFor?.venueId ?? null}
        onCreated={(space) => ctx.addSpace(space)}
      />

      <ConfirmDeleteDialog
        target={deleteTarget}
        title="Delete diagram"
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={remove}
      >
        Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span> from the library? Event plans
        already copied from it are not affected.
      </ConfirmDeleteDialog>
    </MainScreenWrapper>
  );
}

export default VenueDiagramLibraryScreen;
