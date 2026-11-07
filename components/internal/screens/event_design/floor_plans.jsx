"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CalendarPlus, CircleCheck, Copy, Map as MapIcon, PencilLine, Plus, SquarePen, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, SearchInput, StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import { Badge, Button, LogoLoading } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import { copyFloorPlan, listFloorPlans, softDeleteFloorPlan, updateFloorPlan } from "@/lib/supabase/floor_plans";
import { planSummary, setupStyleLabel } from "@/lib/event_design";
import { FloorPlanEditor } from "./editor/plan_editor";
import { createPlanFrom } from "./create_plan";
import { NewPlanDialog } from "./dialogs/new_plan_dialog";
import { AttachEventDialog, ConfirmDeleteDialog } from "./dialogs/plan_dialogs";
import { PlanCard } from "./plan_card";
import { placeLabel, useDesignContext } from "./use_design_context";
import { GALLERY_GRID, PLAN_STATUS_FILTER_OPTIONS } from "./constants";

// Floor Plans hub: a gallery of to-scale plans (live thumbnails); a card opens the editor (?record=<id>).

export function FloorPlansScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const ctx = useDesignContext(projectId);
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [attachTarget, setAttachTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listFloorPlans(projectId, { kind: "plan" }), listFloorPlans(projectId, { kind: "template" })]).then(
      ([rows, tmpl]) => {
        if (!alive) return;
        setPlans(rows ?? []);
        setTemplates(tmpl ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const summaries = useMemo(() => new Map(plans.map((p) => [p.id, planSummary(p)])), [plans]);

  const stats = useMemo(() => {
    const venues = new Set(plans.map((p) => p.venueId).filter(Boolean));
    const seats = plans.reduce((sum, p) => sum + (summaries.get(p.id)?.seats || 0), 0);
    const largest = plans.reduce(
      (best, p) => ((summaries.get(p.id)?.seats || 0) > (best ? summaries.get(best.id).seats : -1) ? p : best),
      null,
    );
    return [
      { label: "Plans", value: String(plans.length), footer: `${plans.filter((p) => p.status === "final").length} final` },
      { label: "Venues covered", value: String(venues.size), footer: "With a plan drawn" },
      { label: "Seats placed", value: seats.toLocaleString(), footer: "Across every plan" },
      {
        label: "Largest plan",
        value: largest ? `${summaries.get(largest.id).seats.toLocaleString()} seats` : "—",
        footer: largest ? largest.name : "No plans yet",
      },
    ];
  }, [plans, summaries]);

  const venueOptions = useMemo(() => {
    const used = new Set(plans.map((p) => p.venueId).filter(Boolean));
    return [
      { value: "all", label: "All venues" },
      ...ctx.venues.filter((v) => used.has(v.id)).map((v) => ({ value: v.id, label: v.name || "Untitled venue" })),
      ...(plans.some((p) => !p.venueId) ? [{ value: "none", label: "No venue" }] : []),
    ];
  }, [plans, ctx.venues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (venueFilter === "none" && p.venueId) return false;
      if (venueFilter !== "all" && venueFilter !== "none" && p.venueId !== venueFilter) return false;
      if (q) {
        const hay = `${p.name} ${placeLabel(p, ctx)} ${ctx.eventById.get(p.eventId)?.name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [plans, search, statusFilter, venueFilter, ctx]);

  const replacePlan = (next) => setPlans((prev) => prev.map((p) => (p.id === next.id ? next : p)));

  const handleCreate = async (input) => {
    const created = await createPlanFrom(input, { projectId });
    if (!created) {
      toast.error("Couldn't create the plan.");
      return false;
    }
    setPlans((prev) => [created, ...prev]);
    if (input.outsideCount) {
      toast.warning(`${input.outsideCount} object${input.outsideCount === 1 ? "" : "s"} fall outside this room — flagged in the editor.`);
    } else {
      toast.success("Plan created.");
    }
    openRecord(created.id);
    return true;
  };

  const handleDuplicate = async (plan) => {
    const user = await getUser();
    const copy = await copyFloorPlan(plan, {
      name: `${plan.name} (copy)`,
      kind: "plan",
      eventId: plan.eventId,
      createdBy: user?.id ?? null,
    });
    if (!copy) {
      toast.error("Couldn't duplicate the plan.");
      return;
    }
    setPlans((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${plan.name}".`);
  };

  const handleStatus = async (plan, status) => {
    replacePlan({ ...plan, status });
    const saved = await updateFloorPlan(plan.id, { status });
    if (!saved) {
      replacePlan(plan);
      toast.error("Couldn't update the status.");
      return;
    }
    toast.success(status === "final" ? "Marked final." : "Back to draft.");
  };

  const handleAttach = async (eventId) => {
    const plan = attachTarget;
    const saved = await updateFloorPlan(plan.id, { eventId });
    if (!saved) {
      toast.error("Couldn't attach the plan.");
      return false;
    }
    replacePlan({ ...plan, eventId: saved.eventId });
    toast.success(eventId ? `Attached to ${ctx.eventById.get(eventId)?.name || "the event"}.` : "Detached from the event.");
    return true;
  };

  const handleDelete = async (plan) => {
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    const ok = await softDeleteFloorPlan(plan.id);
    if (!ok) {
      setPlans((prev) => [plan, ...prev]);
      toast.error("Couldn't delete the plan.");
      return;
    }
    toast.success(`Deleted "${plan.name}".`);
  };

  if (recordId) {
    return <FloorPlanEditor planId={recordId} onBack={closeRecord} backLabel="Floor Plans" onSaved={replacePlan} />;
  }

  const hasFilters = search || venueFilter !== "all" || statusFilter !== "all";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Floor Plans"
        description="To-scale room diagrams — real dimensions, real furniture sizes, seat counts that add up."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New plan
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={venueFilter} onValueChange={setVenueFilter} options={venueOptions} height="h-9" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={PLAN_STATUS_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search plans…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading floor plans" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MapIcon}
            title={plans.length ? "No plans match your filters" : "No floor plans yet"}
            description={
              plans.length
                ? "Try clearing the search or filters."
                : "Draw your first room to scale — start blank, from a venue space, or from a template."
            }
            action={
              plans.length && hasFilters ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setVenueFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> New plan
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className={GALLERY_GRID}>
          {filtered.map((plan) => {
            const event = plan.eventId ? ctx.eventById.get(plan.eventId) : null;
            const place = placeLabel(plan, ctx);
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                subtitle={[place || "No venue", setupStyleLabel(plan.setupStyle)].join(" · ")}
                onOpen={() => openRecord(plan.id)}
                badges={
                  event ? (
                    <Badge variant="info" className="max-w-full">
                      <CalendarDays /> <span className="truncate">{event.name}</span>
                    </Badge>
                  ) : null
                }
                actions={[
                  { icon: SquarePen, label: "Open", onSelect: () => openRecord(plan.id) },
                  { icon: Copy, label: "Duplicate", onSelect: () => handleDuplicate(plan) },
                  { icon: CalendarPlus, label: plan.eventId ? "Change event" : "Attach to event", onSelect: () => setAttachTarget(plan) },
                  plan.status === "final"
                    ? { icon: PencilLine, label: "Back to draft", onSelect: () => handleStatus(plan, "draft") }
                    : { icon: CircleCheck, label: "Mark final", onSelect: () => handleStatus(plan, "final") },
                  { separator: true },
                  { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setDeleteTarget(plan) },
                ]}
              />
            );
          })}
        </div>
      )}

      <NewPlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        ctx={ctx}
        projectId={projectId}
        templates={templates}
        onCreate={handleCreate}
      />

      <AttachEventDialog
        key={attachTarget?.id || "attach-closed"}
        plan={attachTarget}
        events={ctx.events}
        onOpenChange={(o) => !o && setAttachTarget(null)}
        onSave={handleAttach}
      />

      <ConfirmDeleteDialog
        target={deleteTarget}
        title="Delete plan"
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>? Its layout and every object on
        it go with it. This can&apos;t be undone.
      </ConfirmDeleteDialog>
    </MainScreenWrapper>
  );
}

export default FloorPlansScreen;
