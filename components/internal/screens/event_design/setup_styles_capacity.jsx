"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ClipboardCheck, Grid3x3, Loader2, SlidersHorizontal } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader, SearchInput, StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LogoLoading,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import { listFloorPlans } from "@/lib/supabase/floor_plans";
import { updateVenueSpace } from "@/lib/supabase/venue_spaces";
import { saveDesignSettings } from "@/lib/supabase/design_settings";
import { SETUP_STYLES as SPACE_STYLES } from "@/lib/venue_booking/styles";
import {
  CAPACITY_STYLES,
  estimateAllStyles,
  largestEstimate,
  seatTotal,
  spaceMaxOccupancy,
  spaceRoom,
  validatePlanCapacity,
} from "@/lib/event_design";
import { FloorPlanEditor } from "./editor/plan_editor";
import { placeLabel, useDesignContext } from "./use_design_context";
import { CapacityMatrix } from "./capacity/capacity_matrix";
import { PlanChecks } from "./capacity/plan_checks";
import { PlanningRulesForm } from "./capacity/planning_rules_form";
import { primePlanningRules, usePlanningRules } from "./capacity/use_planning_rules";

// Setup Styles & Capacity: what every room holds per setup style (from the planning rules), the rules themselves,
// and an egress / capacity check of every floor plan.

const KIND_OPTIONS = [
  { value: "all", label: "All plans" },
  { value: "plan", label: "Event plans" },
  { value: "template", label: "Templates" },
  { value: "library", label: "Venue diagrams" },
];
const CHECK_OPTIONS = [
  { value: "all", label: "Any result" },
  { value: "issues", label: "Needs attention" },
  { value: "clear", label: "All clear" },
];

// Styles a venue space stores a capacity for (the Venues screen's list); the rest are shown but not written.
const SPACE_STYLE_KEYS = new Set(SPACE_STYLES.map((s) => s.key));

export function SetupStylesCapacityScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const ctx = useDesignContext(projectId);
  const { rules, loaded: rulesLoaded, customised } = usePlanningRules(projectId);
  const [plans, setPlans] = useState(null);
  const [spaces, setSpaces] = useState(null);
  const [tab, setTab] = useState("matrix");
  const [search, setSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [checkFilter, setCheckFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [applyAll, setApplyAll] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    let alive = true;
    listFloorPlans(projectId, { kind: "all" }).then((rows) => {
      if (alive) setPlans(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Local copy of the spaces so capacity / max-occupancy edits show straight away.
  const allSpaces = spaces ?? ctx.spaces;
  const loading = ctx.loading || plans === null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSpaces
      .filter((space) => venueFilter === "all" || space.venueId === venueFilter)
      .filter((space) => !q || `${space.name} ${ctx.venueById.get(space.venueId)?.name || ""}`.toLowerCase().includes(q))
      .map((space) => {
        const room = spaceRoom(space);
        const bestPlans = {};
        for (const plan of plans || []) {
          if (plan.venueSpaceId !== space.id) continue;
          const seats = seatTotal(plan.objects);
          const cur = bestPlans[plan.setupStyle];
          if (seats > 0 && (!cur || seats > cur.seats)) bestPlans[plan.setupStyle] = { plan, seats };
        }
        return {
          space,
          venue: ctx.venueById.get(space.venueId) || null,
          room,
          estimates: room ? estimateAllStyles(room, rules) : null,
          maxOccupancy: spaceMaxOccupancy(space),
          bestPlans,
        };
      });
  }, [allSpaces, plans, rules, search, venueFilter, ctx.venueById]);

  const spaceById = useMemo(() => new Map(allSpaces.map((s) => [s.id, s])), [allSpaces]);
  const checks = useMemo(
    () =>
      (plans || []).map((plan) => ({
        plan,
        place: placeLabel(plan, ctx),
        eventName: plan.eventId ? ctx.eventById.get(plan.eventId)?.name || "" : "",
        check: validatePlanCapacity(plan, { rules, space: plan.venueSpaceId ? spaceById.get(plan.venueSpaceId) : null }),
      })),
    [plans, rules, ctx, spaceById],
  );

  const filteredChecks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return checks
      .filter((c) => kindFilter === "all" || c.plan.kind === kindFilter)
      .filter((c) => checkFilter === "all" || (checkFilter === "issues" ? c.check.issues.length > 0 : c.check.issues.length === 0))
      .filter((c) => !q || `${c.plan.name} ${c.place} ${c.eventName}`.toLowerCase().includes(q))
      .sort((a, b) => b.check.counts.errors - a.check.counts.errors || b.check.issues.length - a.check.issues.length);
  }, [checks, kindFilter, checkFilter, search]);

  const stats = useMemo(() => {
    const measured = rows.filter((r) => r.room);
    const biggest = measured
      .map((r) => ({ r, best: largestEstimate(r.estimates) }))
      .sort((a, b) => (b.best?.estimate || 0) - (a.best?.estimate || 0))[0];
    const attention = checks.filter((c) => c.check.issues.length).length;
    const egress = checks.reduce((n, c) => n + c.check.counts.egress, 0);
    return [
      { label: "Spaces", value: String(allSpaces.length), footer: `${allSpaces.filter((s) => spaceRoom(s)).length} with dimensions` },
      {
        label: "Largest room",
        value: biggest?.best?.estimate ? biggest.best.estimate.toLocaleString() : "—",
        footer: biggest?.best?.estimate ? `${biggest.r.space.name} · ${biggest.best.label.toLowerCase()}` : "Add room dimensions",
      },
      { label: "Plans checked", value: String(checks.length), footer: attention ? `${attention} need attention` : "All clear" },
      { label: "Egress issues", value: String(egress), footer: "Blocked exits, tight aisles, long rows" },
    ];
  }, [rows, checks, allSpaces]);

  const venueOptions = useMemo(
    () => [
      { value: "all", label: "All venues" },
      ...ctx.venues
        .filter((v) => allSpaces.some((s) => s.venueId === v.id))
        .map((v) => ({ value: v.id, label: v.name || "Untitled venue" })),
    ],
    [ctx.venues, allSpaces],
  );

  const replaceSpace = (next) =>
    setSpaces((prev) => (prev ?? ctx.spaces).map((s) => (s.id === next.id ? next : s)));

  // Writes capped estimates onto the spaces' listed capacities (other keys kept).
  const applyEstimates = async (targets) => {
    let done = 0;
    for (const row of targets) {
      if (!row.room || !row.estimates) continue;
      const capacities = { ...(row.space.capacities || {}) };
      for (const style of CAPACITY_STYLES) {
        if (!SPACE_STYLE_KEYS.has(style)) continue;
        const est = row.estimates[style]?.estimate || 0;
        const value = row.maxOccupancy ? Math.min(est, row.maxOccupancy) : est;
        if (value > 0) capacities[style] = value;
      }
      setBusyId(row.space.id);
      const saved = await updateVenueSpace(row.space.id, { capacities });
      if (saved) {
        replaceSpace(saved);
        done += 1;
      }
    }
    setBusyId(null);
    if (done) toast.success(done === 1 ? "Capacities updated." : `Capacities updated on ${done} spaces.`);
    else toast.error("Couldn't update the capacities.");
  };

  const saveMaxOccupancy = async (space, value) => {
    const config = { ...(space.config || {}) };
    if (value) config.maxOccupancy = value;
    else delete config.maxOccupancy;
    const saved = await updateVenueSpace(space.id, { config });
    if (!saved) {
      toast.error("Couldn't save the max occupancy.");
      return;
    }
    replaceSpace(saved);
    toast.success(value ? `Max occupancy set to ${value}.` : "Max occupancy cleared.");
  };

  const saveRules = async (next) => {
    setSavingRules(true);
    const user = await getUser();
    const saved = await saveDesignSettings(projectId, next, { userId: user?.id ?? null });
    setSavingRules(false);
    if (!saved) {
      toast.error("Couldn't save the planning rules.");
      return;
    }
    primePlanningRules(projectId, saved.rules);
    toast.success("Planning rules saved — every estimate and check now uses them.");
  };

  if (recordId) {
    return (
      <FloorPlanEditor
        planId={recordId}
        onBack={closeRecord}
        backLabel="Setup Styles & Capacity"
        onSaved={(next) => setPlans((prev) => (prev || []).map((p) => (p.id === next.id ? next : p)))}
      />
    );
  }

  const sampleSpace =
    [...allSpaces].filter((s) => spaceRoom(s)).sort((a, b) => b.widthM * b.lengthM - a.widthM * a.lengthM)[0] || null;
  const unit = sampleSpace?.unit === "ft" ? "ft" : "m";
  const measuredRows = rows.filter((r) => r.room);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Setup Styles & Capacity"
        description="What each room holds in every setup — from your planning rules — and whether each floor plan keeps its aisles and exits clear."
        actions={
          tab === "matrix" ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!measuredRows.length || Boolean(busyId)}
              onClick={() => setApplyAll(true)}
            >
              {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
              Apply estimates
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-20">
          <LogoLoading size={56} aria-label="Loading capacity" />
        </div>
      ) : (
        <>
          <StatsBar stats={stats} />

          <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-4">
            {/* The tab list shares one row with the active tab's filters. */}
            <Toolbar>
              <TabsList className="flex w-fit max-w-full flex-wrap justify-start">
                <TabsTrigger value="matrix" className="gap-1.5">
                  <Grid3x3 className="h-4 w-4" /> Capacity chart
                </TabsTrigger>
                <TabsTrigger value="checks" className="gap-1.5">
                  <ClipboardCheck className="h-4 w-4" /> Plan checks
                </TabsTrigger>
                <TabsTrigger value="rules" className="gap-1.5">
                  <SlidersHorizontal className="h-4 w-4" /> Planning rules
                </TabsTrigger>
              </TabsList>
              {tab === "matrix" ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full sm:justify-end">
                  <FilterDropdown value={venueFilter} onValueChange={setVenueFilter} options={venueOptions} height="h-9" />
                  <SearchInput value={search} onChange={setSearch} placeholder="Search spaces…" />
                </div>
              ) : tab === "checks" ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full sm:justify-end">
                  <FilterDropdown value={kindFilter} onValueChange={setKindFilter} options={KIND_OPTIONS} height="h-9" />
                  <FilterDropdown value={checkFilter} onValueChange={setCheckFilter} options={CHECK_OPTIONS} height="h-9" />
                  <SearchInput value={search} onChange={setSearch} placeholder="Search plans…" />
                </div>
              ) : null}
            </Toolbar>

            <TabsContent value="matrix" className="min-w-0 space-y-4">
              <CapacityMatrix
                rows={rows}
                unit={unit}
                busyId={busyId}
                onApply={applyEstimates}
                onMaxOccupancy={saveMaxOccupancy}
                onOpenPlan={openRecord}
              />
              <p className="text-xs text-text-tertiary">
                Big number: what the planning rules fit (capped at the max occupancy when one is set). Listed: the space&apos;s
                recorded capacity. Plan: the most seats on a plan drawn for that room and style.
              </p>
            </TabsContent>

            <TabsContent value="checks" className="min-w-0 space-y-4">
              <PlanChecks
                rows={filteredChecks}
                onOpen={openRecord}
                emptyTitle={checks.length ? "No plans match your filters" : "No floor plans yet"}
                emptyDescription={
                  checks.length
                    ? "Try clearing the search or filters."
                    : "Draw a plan under Floor Plans and its capacity and egress checks show up here."
                }
              />
            </TabsContent>

            <TabsContent value="rules" className="min-w-0">
              {rulesLoaded ? (
                <PlanningRulesForm
                  rules={rules}
                  customised={customised}
                  sampleSpace={sampleSpace}
                  saving={savingRules}
                  onSave={saveRules}
                />
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
                  <LogoLoading size={48} aria-label="Loading planning rules" />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={applyAll} onOpenChange={setApplyAll}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply estimates to every space</DialogTitle>
            <DialogDescription>
              Overwrites the listed {SPACE_STYLES.map((s) => s.label.toLowerCase()).join(", ")} capacities on{" "}
              {measuredRows.length} space{measuredRows.length === 1 ? "" : "s"} with the planning estimates (capped at max
              occupancy). Venue booking and plan checks use the new figures.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApplyAll(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setApplyAll(false);
                applyEstimates(measuredRows);
              }}
            >
              <ArrowDownToLine className="h-4 w-4" /> Apply to {measuredRows.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default SetupStylesCapacityScreen;
