"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarX2, Link2, Map as MapIcon } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { Button, LogoLoading, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getFloorPlan, listFloorPlans, updateFloorPlan } from "@/lib/supabase/floor_plans";
import { setupStyleLabel } from "@/lib/event_design";
import { FloorPlanEditor } from "./editor/plan_editor";
import { useDesignContext } from "./use_design_context";
import { ChartWorkspace } from "./seating/chart_workspace";
import { AttachPlanDialog } from "./seating/dialogs";

// Seating Charts: pick an event and one of its floor plans, then seat the event's guests on it — meals, rules, printouts.

const OUTLINE = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

export function SeatingChartsScreen() {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const ctx = useDesignContext(projectId);
  const [plans, setPlans] = useState(null);
  const [eventPick, setEventPick] = useState(null);
  const [planPick, setPlanPick] = useState(null);
  const [editing, setEditing] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    listFloorPlans(projectId, { kind: "plan" }).then((rows) => {
      if (alive) setPlans(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const plansByEvent = useMemo(() => {
    const map = new Map();
    for (const p of plans || []) {
      if (!p.eventId) continue;
      if (!map.has(p.eventId)) map.set(p.eventId, []);
      map.get(p.eventId).push(p);
    }
    return map;
  }, [plans]);

  const events = ctx.events;
  const eventId =
    eventPick && events.some((e) => e.id === eventPick)
      ? eventPick
      : events.find((e) => plansByEvent.has(e.id))?.id || events[0]?.id || null;
  const event = eventId ? ctx.eventById.get(eventId) || null : null;
  const eventPlans = plansByEvent.get(eventId) || [];
  const plan = eventPlans.find((p) => p.id === planPick) || eventPlans[0] || null;
  const attachable = (plans || []).filter((p) => p.eventId !== eventId);

  const replacePlan = (next) => next && setPlans((prev) => (prev || []).map((p) => (p.id === next.id ? next : p)));

  const attach = async (planId) => {
    const saved = await updateFloorPlan(planId, { eventId });
    if (!saved) {
      toast.error("Couldn't attach the plan.");
      return false;
    }
    replacePlan(saved);
    setPlanPick(saved.id);
    toast.success(`${saved.name} is now ${event?.name || "this event"}'s seating plan.`);
    return true;
  };

  if (editing && plan) {
    return (
      <FloorPlanEditor
        planId={plan.id}
        backLabel="Seating Charts"
        onSaved={replacePlan}
        onBack={async () => {
          setEditing(false);
          replacePlan(await getFloorPlan(plan.id));
        }}
      />
    );
  }

  const loading = ctx.loading || plans === null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Seating Charts"
        description="Seat your event's guests at tables on its floor plan — parties together, meals tallied, place cards ready to print."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={eventId || ""}
              onValueChange={(id) => {
                setEventPick(id);
                setPlanPick(null);
              }}
              disabled={!events.length}
            >
              <SelectTrigger className="h-9 w-full bg-surface-card sm:w-56" aria-label="Event">
                <SelectValue placeholder={loading ? "Loading events…" : "Pick an event"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name || "Untitled event"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eventPlans.length > 1 ? (
              <Select value={plan?.id || ""} onValueChange={setPlanPick}>
                <SelectTrigger className="h-9 w-full bg-surface-card sm:w-56" aria-label="Floor plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {eventPlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || "Untitled plan"} · {setupStyleLabel(p.setupStyle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {eventId ? (
              <Button variant="outline" className={OUTLINE} onClick={() => setAttachOpen(true)}>
                <Link2 className="h-4 w-4" /> Attach plan
              </Button>
            ) : null}
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-20">
          <LogoLoading size={56} aria-label="Loading seating charts" />
        </div>
      ) : !events.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CalendarX2}
            title="No events yet"
            description="Seating charts belong to an event. Create an event, draw its room under Floor Plans, then seat guests here."
          />
        </div>
      ) : !plan ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MapIcon}
            title="No floor plan for this event"
            description="Attach one of your floor plans to this event, or draw a new one under Floor Plans."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" className={OUTLINE} onClick={() => setTab("Floor Plans")}>
                  Go to Floor Plans
                </Button>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAttachOpen(true)}>
                  <Link2 className="h-4 w-4" /> Attach a plan
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <ChartWorkspace
          key={plan.id}
          projectId={projectId}
          event={event}
          plan={plan}
          onPlanChange={replacePlan}
          onEditLayout={() => setEditing(true)}
        />
      )}

      <AttachPlanDialog
        key={attachOpen ? `attach-${eventId}` : "attach-closed"}
        open={attachOpen}
        onOpenChange={setAttachOpen}
        plans={attachable}
        eventName={event?.name}
        onAttach={attach}
      />
    </MainScreenWrapper>
  );
}

export default SeatingChartsScreen;
