"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, CalendarDays, Footprints, Map as MapIcon, PencilRuler, Rotate3d } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorHeader } from "@/components/internal/shared/editor_shell";
import { EmptyState, ScreenHeader, SearchInput, StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import { Badge, Button, LogoLoading } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { tabToSlug } from "@/lib/workspace/tabs";
import { getFloorPlan, listFloorPlans } from "@/lib/supabase/floor_plans";
import {
  ceilingHeight,
  formatArea,
  formatDimensions,
  formatLength,
  planSummary,
  roomArea,
  setupStyleLabel,
} from "@/lib/event_design";
import { PlanCard } from "./plan_card";
import { placeLabel, useDesignContext } from "./use_design_context";
import { GALLERY_GRID } from "./constants";
import { Plan3DViewer, usePlanViewpoints } from "./walkthrough/plan_3d_viewer";
import { DEFAULT_VIEW_OPTIONS, ViewerToggles } from "./walkthrough/walkthrough_action";

// 3D Walkthrough: pick a saved plan, then orbit it as a dollhouse or walk it first-person — viewpoints, seated views, screenshots.

const KIND_OPTIONS = [
  { value: "plan", label: "Floor plans" },
  { value: "template", label: "Room templates" },
  { value: "library", label: "Venue diagrams" },
  { value: "all", label: "Everything" },
];
const KIND_LABEL = { template: "Template", library: "Venue diagram" };
const TABLES_SHOWN = 12;

function PanelSection({ title, children }) {
  return (
    <div className="space-y-3 border-b border-border p-4 last:border-b-0">
      {title ? <p className="text-xs font-medium text-text-tertiary">{title}</p> : null}
      {children}
    </div>
  );
}

function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="min-w-0 truncate text-right tabular-nums text-foreground">{children}</span>
    </div>
  );
}

function ViewpointButton({ view, onClick }) {
  const Icon = view.mode === "orbit" ? Rotate3d : Footprints;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      <Icon className="h-4 w-4 shrink-0 text-text-tertiary" />
      <span className="truncate">{view.label}</span>
    </button>
  );
}

function WalkthroughViewer({ planId, ctx, onBack, onEdit }) {
  const [loaded, setLoaded] = useState({ id: null, plan: null });
  const [options, setOptions] = useState(DEFAULT_VIEW_OPTIONS);
  const [focus, setFocus] = useState(null);
  const [allTables, setAllTables] = useState(false);

  useEffect(() => {
    let alive = true;
    getFloorPlan(planId).then((p) => alive && setLoaded({ id: planId, plan: p || false }));
    return () => {
      alive = false;
    };
  }, [planId]);

  const plan = loaded.id === planId ? loaded.plan : null;
  const space = plan?.venueSpaceId ? ctx.spaceById.get(plan.venueSpaceId) || null : null;
  const viewpoints = usePlanViewpoints(plan || null, space?.heightM);
  const summary = useMemo(() => (plan ? planSummary(plan) : null), [plan]);

  if (plan === null) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center">
        <LogoLoading size={80} aria-label="Loading the plan" />
      </div>
    );
  }
  if (plan === false) {
    return (
      <MainScreenWrapper>
        <EmptyState
          icon={MapIcon}
          title="Plan not found"
          description="It may have been deleted, or you no longer have access to it."
          action={
            <Button variant="ghost" onClick={onBack}>
              Back to 3D Walkthrough
            </Button>
          }
        />
      </MainScreenWrapper>
    );
  }

  const ceiling = ceilingHeight(plan, space?.heightM);
  const event = plan.eventId ? ctx.eventById.get(plan.eventId) : null;
  const roomViews = viewpoints.filter((v) => v.group === "room");
  const tableViews = viewpoints.filter((v) => v.group === "table");
  const shownTables = allTables ? tableViews : tableViews.slice(0, TABLES_SHOWN);
  const go = (key) => setFocus((f) => ({ key, nonce: (f?.nonce || 0) + 1 }));

  return (
    <MainScreenWrapper className="lg:flex lg:h-full lg:max-w-none lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden lg:py-0">
      <EditorHeader
        className="pb-4 lg:shrink-0"
        back={{ label: "3D Walkthrough", onClick: onBack }}
        title={<h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{plan.name || "Untitled plan"}</h1>}
        badges={
          <>
            {KIND_LABEL[plan.kind] ? <Badge variant="info">{KIND_LABEL[plan.kind]}</Badge> : null}
            {event ? (
              <Badge variant="info" className="max-w-full">
                <CalendarDays /> <span className="truncate">{event.name}</span>
              </Badge>
            ) : null}
          </>
        }
        actions={
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onEdit(plan)}
          >
            <PencilRuler className="h-4 w-4" /> Edit plan
          </Button>
        }
      />

      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface-subtle lg:min-h-0 lg:flex-1">
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]">
          <div className="h-[65vh] min-h-0 lg:h-auto">
            <Plan3DViewer plan={plan} ceilingHeightM={space?.heightM} focus={focus} {...options} />
          </div>
          <aside className="scrollbar-subtle min-h-0 overflow-y-auto border-t border-border lg:border-l lg:border-t-0">
            <PanelSection title="Room">
              <Fact label="Where">{placeLabel(plan, ctx) || "No venue"}</Fact>
              <Fact label="Size">{formatDimensions(plan.widthM, plan.lengthM, plan.unit)}</Fact>
              <Fact label="Area">{formatArea(roomArea(plan), plan.unit)}</Fact>
              <Fact label="Ceiling">
                {formatLength(ceiling, plan.unit)}
                {space?.heightM ? "" : " (assumed)"}
              </Fact>
              <Fact label="Setup">{setupStyleLabel(plan.setupStyle)}</Fact>
            </PanelSection>
            <PanelSection title="Capacity">
              <Fact label="Seats placed">{summary.seats.toLocaleString()}</Fact>
              <Fact label="Tables">{(plan.objects || []).filter((o) => o.category === "tables").length}</Fact>
              <Fact label="Objects">{summary.objectCount}</Fact>
            </PanelSection>
            <PanelSection title="Viewpoints">
              <div className="-mx-2 space-y-0.5">
                {roomViews.map((v) => (
                  <ViewpointButton key={v.key} view={v} onClick={() => go(v.key)} />
                ))}
              </div>
              {tableViews.length ? (
                <>
                  <p className="pt-1 text-xs font-medium text-text-tertiary">Seated at</p>
                  <div className="grid grid-cols-2 gap-1">
                    {shownTables.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => go(v.key)}
                        className="truncate rounded-lg border border-border bg-surface-card px-2 py-1.5 text-left text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-foreground"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  {tableViews.length > TABLES_SHOWN ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-text-secondary hover:text-foreground"
                      onClick={() => setAllTables((a) => !a)}
                    >
                      {allTables ? "Show fewer" : `Show all ${tableViews.length} tables`}
                    </button>
                  ) : null}
                </>
              ) : null}
            </PanelSection>
            <PanelSection title="Display">
              <ViewerToggles value={options} onChange={setOptions} stacked />
            </PanelSection>
            <PanelSection>
              <p className="text-xs leading-relaxed text-text-secondary">
                This is the plan&apos;s last save. Use <span className="font-medium text-foreground">3D</span> in the
                editor to see unsaved changes live.
                {space?.heightM ? "" : " Set the venue space's ceiling height for a true-to-life room."}
              </p>
            </PanelSection>
          </aside>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export function Walkthrough3DScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const router = useRouter();
  const ctx = useDesignContext(projectId);
  const [plans, setPlans] = useState(null);
  const [kind, setKind] = useState("plan");
  const [venueFilter, setVenueFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    listFloorPlans(projectId, { kind: "all" }).then((rows) => alive && setPlans(rows ?? []));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const editPlan = (plan) => {
    const tab = plan.kind === "template" ? "Room Templates" : plan.kind === "library" ? "Venue Diagram Library" : "Floor Plans";
    router.push(`/project/${projectId}/${tabToSlug(tab)}?record=${plan.id}`);
  };

  const list = useMemo(() => plans || [], [plans]);
  const ofKind = useMemo(() => (kind === "all" ? list : list.filter((p) => p.kind === kind)), [list, kind]);

  const stats = useMemo(() => {
    const floorPlans = list.filter((p) => p.kind === "plan");
    const summaries = floorPlans.map((p) => ({ plan: p, ...planSummary(p) }));
    const withSpace = floorPlans.filter((p) => p.venueSpaceId);
    const withHeight = withSpace.filter((p) => ctx.spaceById.get(p.venueSpaceId)?.heightM);
    const largest = summaries.reduce((best, s) => (!best || s.areaM2 > best.areaM2 ? s : best), null);
    return [
      {
        label: "Plans to walk",
        value: String(floorPlans.length),
        footer: `${summaries.filter((s) => s.objectCount > 0).length} furnished`,
      },
      {
        label: "Seats",
        value: summaries.reduce((n, s) => n + s.seats, 0).toLocaleString(),
        footer: "Across every plan",
      },
      {
        label: "True ceilings",
        value: withSpace.length ? `${withHeight.length}/${withSpace.length}` : "—",
        footer: "Spaces with a height set",
      },
      {
        label: "Largest room",
        value: largest ? formatArea(largest.areaM2, largest.plan.unit) : "—",
        footer: largest ? largest.plan.name : "No plans yet",
      },
    ];
  }, [list, ctx.spaceById]);

  const venueOptions = useMemo(() => {
    const used = new Set(ofKind.map((p) => p.venueId).filter(Boolean));
    return [
      { value: "all", label: "All venues" },
      ...ctx.venues.filter((v) => used.has(v.id)).map((v) => ({ value: v.id, label: v.name || "Untitled venue" })),
    ];
  }, [ofKind, ctx.venues]);

  const eventOptions = useMemo(() => {
    const used = new Set(ofKind.map((p) => p.eventId).filter(Boolean));
    return [
      { value: "all", label: "All events" },
      ...ctx.events.filter((e) => used.has(e.id)).map((e) => ({ value: e.id, label: e.name || "Untitled event" })),
    ];
  }, [ofKind, ctx.events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ofKind.filter((p) => {
      if (venueFilter !== "all" && p.venueId !== venueFilter) return false;
      if (eventFilter !== "all" && p.eventId !== eventFilter) return false;
      if (q && !`${p.name} ${placeLabel(p, ctx)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ofKind, venueFilter, eventFilter, search, ctx]);

  if (recordId) {
    return <WalkthroughViewer planId={recordId} ctx={ctx} onBack={closeRecord} onEdit={editPlan} />;
  }

  const hasFilters = search || venueFilter !== "all" || eventFilter !== "all";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="3D Walkthrough"
        description="Step inside any saved plan — orbit the room like a dollhouse, or walk it at eye level and sit at any table to see the stage."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={kind} onValueChange={setKind} options={KIND_OPTIONS} height="h-9" />
          <FilterDropdown value={venueFilter} onValueChange={setVenueFilter} options={venueOptions} height="h-9" />
          <FilterDropdown value={eventFilter} onValueChange={setEventFilter} options={eventOptions} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search plans…" />
      </Toolbar>

      {plans === null ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading plans" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Box}
            title={ofKind.length ? "No plans match your filters" : "Nothing to walk through yet"}
            description={
              ofKind.length
                ? "Try clearing the search or filters."
                : "Draw a floor plan first — every saved plan can be explored here in 3D."
            }
            action={
              ofKind.length && hasFilters ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setVenueFilter("all");
                    setEventFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : !list.length ? (
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => router.push(`/project/${projectId}/${tabToSlug("Floor Plans")}`)}
                >
                  <MapIcon className="h-4 w-4" /> Go to Floor Plans
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className={GALLERY_GRID}>
          {filtered.map((plan) => {
            const event = plan.eventId ? ctx.eventById.get(plan.eventId) : null;
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                showStatus={plan.kind === "plan"}
                subtitle={[placeLabel(plan, ctx) || "No venue", setupStyleLabel(plan.setupStyle)].join(" · ")}
                onOpen={() => openRecord(plan.id)}
                badges={
                  <>
                    {KIND_LABEL[plan.kind] ? <Badge variant="info">{KIND_LABEL[plan.kind]}</Badge> : null}
                    {event ? (
                      <Badge variant="info" className="max-w-full">
                        <CalendarDays /> <span className="truncate">{event.name}</span>
                      </Badge>
                    ) : null}
                  </>
                }
                actions={[
                  { icon: Box, label: "Walk through in 3D", onSelect: () => openRecord(plan.id) },
                  { icon: PencilRuler, label: "Edit plan", onSelect: () => editPlan(plan) },
                ]}
              />
            );
          })}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default Walkthrough3DScreen;
