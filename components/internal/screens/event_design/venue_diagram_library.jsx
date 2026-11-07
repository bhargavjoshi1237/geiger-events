"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, CalendarPlus, Copy, Library, Plus, SquarePen, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, SearchInput, StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import { Button, LogoLoading } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import { copyFloorPlan, listFloorPlans, softDeleteFloorPlan } from "@/lib/supabase/floor_plans";
import { formatDimensions, setupStyleLabel } from "@/lib/event_design";
import { cn } from "@/lib/utils";
import { FloorPlanEditor } from "./editor/plan_editor";
import { NewPlanDialog } from "./dialogs/new_plan_dialog";
import { NewSpaceDialog } from "./dialogs/space_picker";
import { ConfirmDeleteDialog } from "./dialogs/plan_dialogs";
import { PlanCard } from "./plan_card";
import { createPlanFrom } from "./create_plan";
import { useDesignContext } from "./use_design_context";
import { SETUP_STYLE_FILTER_OPTIONS } from "./constants";

// Venue Diagram Library: each venue space's standard diagrams (floor_plans kind "library"), copied into event plans on demand.

function NavRow({ active, onClick, label, meta, count, indent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        indent && "pl-7",
        active
          ? "bg-surface-card font-medium text-foreground dark:text-white"
          : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {meta ? <span className="block truncate text-[11px] font-normal text-text-tertiary">{meta}</span> : null}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{count}</span>
    </button>
  );
}

export function VenueDiagramLibraryScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const ctx = useDesignContext(projectId);
  const [diagrams, setDiagrams] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState({ venueId: null, spaceId: null });
  const [style, setStyle] = useState("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
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

  const countBy = useMemo(() => {
    const venue = new Map();
    const space = new Map();
    diagrams.forEach((d) => {
      if (d.venueId) venue.set(d.venueId, (venue.get(d.venueId) || 0) + 1);
      if (d.venueSpaceId) space.set(d.venueSpaceId, (space.get(d.venueSpaceId) || 0) + 1);
    });
    return { venue, space };
  }, [diagrams]);

  const stats = useMemo(
    () => [
      { label: "Diagrams", value: String(diagrams.length), footer: "Standard layouts on file" },
      { label: "Venues", value: String(countBy.venue.size), footer: "With a diagram" },
      { label: "Spaces covered", value: String(countBy.space.size), footer: `Of ${ctx.spaces.length} spaces` },
      {
        label: "Setup styles",
        value: String(new Set(diagrams.map((d) => d.setupStyle)).size),
        footer: "Covered across rooms",
      },
    ],
    [diagrams, countBy, ctx.spaces.length],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return diagrams.filter((d) => {
      if (scope.spaceId && d.venueSpaceId !== scope.spaceId) return false;
      if (!scope.spaceId && scope.venueId && d.venueId !== scope.venueId) return false;
      if (style !== "all" && d.setupStyle !== style) return false;
      if (q && !`${d.name} ${d.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [diagrams, scope, style, search]);

  const scopeVenue = scope.venueId ? ctx.venueById.get(scope.venueId) : null;
  const scopeSpace = scope.spaceId ? ctx.spaceById.get(scope.spaceId) : null;

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

  const heading = scopeSpace
    ? `${scopeVenue?.name || "Venue"} · ${scopeSpace.name}`
    : scopeVenue
      ? scopeVenue.name
      : "All diagrams";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Venue Diagram Library"
        description="Each room's standard layouts — theatre, banquet, reception — kept on file and copied into an event's plan in one step."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!ctx.venues.length}
            onClick={() => (ctx.spaces.length ? setNewOpen(true) : setSpaceOpen(true))}
          >
            <Plus className="h-4 w-4" /> New diagram
          </Button>
        }
      />

      <StatsBar stats={stats} />

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
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-0.5 lg:sticky lg:top-0 lg:self-start">
            <NavRow
              active={!scope.venueId}
              onClick={() => setScope({ venueId: null, spaceId: null })}
              label="All diagrams"
              count={diagrams.length}
            />
            {ctx.venues.map((venue) => {
              const spaces = ctx.spaces.filter((s) => s.venueId === venue.id);
              return (
                <div key={venue.id} className="pt-2">
                  <NavRow
                    active={scope.venueId === venue.id && !scope.spaceId}
                    onClick={() => setScope({ venueId: venue.id, spaceId: null })}
                    label={venue.name || "Untitled venue"}
                    meta={spaces.length ? `${spaces.length} space${spaces.length === 1 ? "" : "s"}` : "No spaces yet"}
                    count={countBy.venue.get(venue.id) || 0}
                  />
                  {spaces.map((space) => (
                    <NavRow
                      key={space.id}
                      indent
                      active={scope.spaceId === space.id}
                      onClick={() => setScope({ venueId: venue.id, spaceId: space.id })}
                      label={space.name}
                      meta={space.widthM && space.lengthM ? formatDimensions(space.widthM, space.lengthM, space.unit) : null}
                      count={countBy.space.get(space.id) || 0}
                    />
                  ))}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setSpaceOpen(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-subtle hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> New space
            </button>
          </aside>

          <div className="min-w-0 space-y-4">
            <Toolbar>
              <div className="flex min-w-0 items-center gap-2">
                <FilterDropdown value={style} onValueChange={setStyle} options={SETUP_STYLE_FILTER_OPTIONS} height="h-9" />
                <span className="hidden truncate text-sm font-medium text-foreground sm:inline">{heading}</span>
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Search diagrams…" />
            </Toolbar>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Library}
                  title={diagrams.length ? "No diagrams here" : "No venue diagrams yet"}
                  description={
                    scopeVenue && !ctx.spaces.some((s) => s.venueId === scopeVenue.id)
                      ? "This venue has no spaces yet — add one, then file its standard layouts."
                      : "Draw a room's standard layout once and reuse it for every event held there. Any plan can be added from its editor too."
                  }
                  action={
                    scopeVenue && !ctx.spaces.some((s) => s.venueId === scopeVenue.id) ? (
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setSpaceOpen(true)}>
                        <Plus className="h-4 w-4" /> New space
                      </Button>
                    ) : ctx.spaces.length ? (
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setNewOpen(true)}>
                        <Plus className="h-4 w-4" /> New diagram
                      </Button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {filtered.map((d) => {
                  const space = d.venueSpaceId ? ctx.spaceById.get(d.venueSpaceId) : null;
                  const venue = d.venueId ? ctx.venueById.get(d.venueId) : null;
                  return (
                    <PlanCard
                      key={d.id}
                      plan={d}
                      showStatus={false}
                      subtitle={[scope.spaceId ? null : venue?.name, space?.name || "No space", setupStyleLabel(d.setupStyle)]
                        .filter(Boolean)
                        .join(" · ")}
                      onOpen={() => openRecord(d.id)}
                      footerAction={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-muted-foreground hover:bg-surface-active hover:text-foreground"
                          disabled={!ctx.events.length}
                          onClick={() => setUseTarget(d)}
                        >
                          <CalendarPlus className="h-3.5 w-3.5" /> Use for event
                        </Button>
                      }
                      actions={[
                        { icon: CalendarPlus, label: "Use for event", disabled: !ctx.events.length, onSelect: () => setUseTarget(d) },
                        { icon: SquarePen, label: "Edit layout", onSelect: () => openRecord(d.id) },
                        { icon: Copy, label: "Duplicate", onSelect: () => duplicate(d) },
                        { separator: true },
                        { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setDeleteTarget(d) },
                      ]}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <NewPlanDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        ctx={ctx}
        projectId={projectId}
        templates={templates}
        kind="library"
        requireSpace
        initial={{ source: "space", venueId: scope.venueId, spaceId: scope.spaceId }}
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
        open={spaceOpen}
        onOpenChange={setSpaceOpen}
        projectId={projectId}
        venues={ctx.venues}
        defaultVenueId={scope.venueId}
        onCreated={(space) => {
          ctx.addSpace(space);
          setScope({ venueId: space.venueId, spaceId: space.id });
        }}
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
