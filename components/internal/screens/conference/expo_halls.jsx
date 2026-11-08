"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Copy, Plus, SquarePen, Store, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, SearchInput, StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LogoLoading,
} from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { currency } from "@/components/internal/screens/tickets/constants";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import { listFloorPlans } from "@/lib/supabase/floor_plans";
import { createHallMap, listLiveBooths, softDeleteHallMap } from "@/lib/supabase/hall_maps";
import { archiveExpoHall, convertLegacyHall, listExpoHalls } from "@/lib/supabase/expo_halls";
import { boothSummary, planFromHallBooths } from "@/lib/event_design";
import { FloorPlanEditor } from "@/components/internal/screens/event_design/editor/plan_editor";
import { NewPlanDialog } from "@/components/internal/screens/event_design/dialogs/new_plan_dialog";
import { ConfirmDeleteDialog } from "@/components/internal/screens/event_design/dialogs/plan_dialogs";
import { PlanCard } from "@/components/internal/screens/event_design/plan_card";
import { createPlanFrom } from "@/components/internal/screens/event_design/create_plan";
import { placeLabel, useDesignContext } from "@/components/internal/screens/event_design/use_design_context";
import { GALLERY_GRID } from "@/components/internal/screens/event_design/constants";
import { DEMO_HALL } from "./demo_floor_plan";

// Floor Plan & Booths: every exhibitor hall, drawn in the Event Design editor. Saving a hall publishes its booths to
// every event that sells it (hall_booths); halls from before the editor convert to a plan the first time they're opened.

export const HALLS_TAB = "Floor Plan & Booths";

// Events selling booths, keyed by hall map id.
export function eventsByHall(events) {
  const map = new Map();
  for (const e of events || []) {
    const id = e?.expo?.hallMapId;
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(e);
  }
  return map;
}

const venueOf = (h) => h.plan?.venueId ?? h.map?.venueId ?? null;
const mapIdOf = (h) => h.plan?.hallMapId ?? h.map?.id ?? null;

export function ExpoHallsScreen({ demo = false }) {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const ctx = useDesignContext(projectId);
  const [halls, setHalls] = useState(() => (demo ? [{ id: DEMO_HALL.id, plan: DEMO_HALL, map: null }] : []));
  const [previews, setPreviews] = useState(() => new Map());
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(!demo);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    if (demo || recordId) return undefined;
    let alive = true;
    Promise.all([listExpoHalls(projectId), listFloorPlans(projectId, { kind: "template" })]).then(async ([rows, tmpl]) => {
      if (!alive) return;
      const list = rows ?? [];
      setHalls(list);
      setTemplates(tmpl ?? []);
      setLoading(false);
      // Legacy halls have no plan to draw a thumbnail from; build one from their booth rows.
      const legacy = list.filter((h) => !h.plan);
      if (!legacy.length) return;
      const booths = await listLiveBooths(legacy.map((h) => h.map.id));
      if (!alive || !booths) return;
      setPreviews(
        new Map(
          legacy.map((h) => [
            h.id,
            {
              id: h.id,
              name: h.map.name,
              ...planFromHallBooths(booths.filter((b) => b.hallMapId === h.map.id), h.map.aspect),
            },
          ]),
        ),
      );
    });
    return () => {
      alive = false;
    };
  }, [projectId, demo, recordId, reloadKey]);

  const selling = useMemo(() => eventsByHall(ctx.events), [ctx.events]);
  const summaries = useMemo(
    () => new Map(halls.map((h) => [h.id, boothSummary((h.plan || previews.get(h.id))?.objects)])),
    [halls, previews],
  );

  const stats = useMemo(() => {
    const booths = halls.reduce((n, h) => n + (summaries.get(h.id)?.count || 0), 0);
    const value = halls.reduce((n, h) => n + (summaries.get(h.id)?.value || 0), 0);
    const eventCount = halls.reduce((n, h) => n + (selling.get(mapIdOf(h))?.length || 0), 0);
    return [
      { label: "Halls", value: String(halls.length), footer: `${halls.filter((h) => h.plan).length} drawn to scale` },
      { label: "Booths", value: booths.toLocaleString(), footer: "Across every hall" },
      { label: "Floor value", value: currency(value), footer: "At list price" },
      { label: "Selling events", value: String(eventCount), footer: "Events selling a hall" },
    ];
  }, [halls, summaries, selling]);

  const venueOptions = useMemo(() => {
    const used = new Set(halls.map(venueOf).filter(Boolean));
    return [
      { value: "all", label: "All venues" },
      ...ctx.venues.filter((v) => used.has(v.id)).map((v) => ({ value: v.id, label: v.name || "Untitled venue" })),
      ...(halls.some((h) => !venueOf(h)) ? [{ value: "none", label: "No venue" }] : []),
    ];
  }, [halls, ctx.venues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return halls.filter((h) => {
      const venueId = venueOf(h);
      if (venueFilter === "none" && venueId) return false;
      if (venueFilter !== "all" && venueFilter !== "none" && venueId !== venueFilter) return false;
      if (q) {
        const name = h.plan?.name || h.map?.name || "";
        const place = h.plan ? placeLabel(h.plan, ctx) : ctx.venueById.get(venueId)?.name || "";
        if (!`${name} ${place}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [halls, search, venueFilter, ctx]);

  // A new hall = a hall map (what events sell against) + its expo plan (the design), linked one-to-one.
  const createHall = async (input) => {
    const user = await getUser();
    const map = await createHallMap({
      projectId,
      venueId: input.venueId ?? null,
      name: input.name || "Exhibitor hall",
      status: "Active",
      createdBy: user?.id ?? null,
    });
    if (!map) {
      toast.error("Couldn't create the hall.");
      return false;
    }
    const plan = await createPlanFrom(input, { projectId, kind: "expo", hallMapId: map.id });
    if (!plan) {
      await softDeleteHallMap(map.id);
      toast.error("Couldn't create the hall.");
      return false;
    }
    setHalls((prev) => [{ id: plan.id, plan, map }, ...prev]);
    toast.success("Hall created — add booths from the library.");
    openRecord(plan.id);
    return true;
  };

  const duplicate = (h) =>
    createHall({
      name: `${h.plan.name} (copy)`,
      venueId: h.plan.venueId,
      venueSpaceId: h.plan.venueSpaceId,
      widthM: h.plan.widthM,
      lengthM: h.plan.lengthM,
      unit: h.plan.unit,
      setupStyle: "custom",
      sourcePlan: h.plan,
    });

  const open = async (h) => {
    if (demo) return;
    if (h.plan) {
      openRecord(h.plan.id);
      return;
    }
    setOpening(h.id);
    const plan = await convertLegacyHall(h.map, { projectId });
    setOpening(null);
    if (!plan) {
      toast.error("Couldn't open this hall in the editor.");
      setReloadKey((k) => k + 1);
      return;
    }
    if (plan.boothSync === "failed") toast.error("The hall opened, but its booths didn't sync — save once in the editor.");
    setHalls((prev) => prev.map((x) => (x.id === h.id ? { id: plan.id, plan, map: h.map } : x)));
    openRecord(plan.id);
  };

  const remove = async (h) => {
    setHalls((prev) => prev.filter((x) => x.id !== h.id));
    const ok = await archiveExpoHall(h);
    if (!ok) {
      setHalls((prev) => [h, ...prev]);
      toast.error("Couldn't delete the hall.");
      return;
    }
    toast.success(`Deleted "${h.plan?.name || h.map?.name}".`);
  };

  if (recordId && !demo) {
    return (
      <FloorPlanEditor
        planId={recordId}
        onBack={closeRecord}
        backLabel={HALLS_TAB}
        onSaved={(p) => setHalls((prev) => prev.map((h) => (h.plan?.id === p.id ? { ...h, plan: p } : h)))}
      />
    );
  }

  const deleteUsers = deleteTarget ? selling.get(mapIdOf(deleteTarget)) || [] : [];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title={HALLS_TAB}
        description="Exhibitor halls drawn to scale. Place, number and price booths here — saving publishes them to every event that sells the hall."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={demo}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> New hall
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={venueFilter} onValueChange={setVenueFilter} options={venueOptions} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search halls…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading exhibitor halls" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Store}
            title={halls.length ? "No halls match" : "No exhibitor halls yet"}
            description={
              halls.length
                ? "Try another venue or search."
                : "Draw your expo floor to scale — from a venue room or a blank hall — then drop in booths and number them."
            }
            action={
              halls.length ? null : (
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> New hall
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className={GALLERY_GRID}>
          {filtered.map((h) => {
            const plan = h.plan || previews.get(h.id) || { id: h.id, name: h.map?.name, widthM: 40, lengthM: 30, objects: [] };
            const summary = summaries.get(h.id) || { count: 0, value: 0 };
            const events = selling.get(mapIdOf(h)) || [];
            const venueName = ctx.venueById.get(venueOf(h))?.name;
            const place = h.plan ? placeLabel(h.plan, ctx) : venueName;
            return (
              <PlanCard
                key={h.id}
                plan={{ ...plan, name: h.plan?.name || h.map?.name || "Exhibitor hall" }}
                showStatus={false}
                subtitle={place || "No venue"}
                onOpen={() => open(h)}
                badges={
                  <>
                    {events.length ? (
                      <Badge variant="info" className="max-w-full">
                        <CalendarDays />
                        <span className="truncate">
                          {events.length === 1 ? events[0].name : `${events.length} events`}
                        </span>
                      </Badge>
                    ) : null}
                    {h.plan ? null : <Badge variant="neutral">{opening === h.id ? "Opening…" : "Older layout"}</Badge>}
                  </>
                }
                footerAction={
                  <span>
                    {summary.count} booth{summary.count === 1 ? "" : "s"} · {currency(summary.value)}
                  </span>
                }
                actions={
                  demo
                    ? []
                    : [
                        { icon: SquarePen, label: "Open", onSelect: () => open(h) },
                        h.plan && { icon: Copy, label: "Duplicate", onSelect: () => duplicate(h) },
                        { separator: true },
                        { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setDeleteTarget(h) },
                      ].filter(Boolean)
                }
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
        kind="expo"
        initial={{ source: ctx.spaces.length ? "space" : "blank" }}
        title="New exhibitor hall"
        description="Draw the hall at its real size — pick the venue room, or start from a blank hall or a template."
        submitLabel="Create hall"
        onCreate={createHall}
      />

      <ConfirmDeleteDialog
        target={deleteUsers.length ? null : deleteTarget}
        title="Delete hall"
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={remove}
      >
        Delete <span className="font-medium text-foreground">{deleteTarget?.plan?.name || deleteTarget?.map?.name}</span>?
        Its layout goes with it; booths already sold stay on their orders.
      </ConfirmDeleteDialog>

      <Dialog open={Boolean(deleteTarget && deleteUsers.length)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hall in use</DialogTitle>
            <DialogDescription>
              {deleteUsers.map((e) => e.name || "Untitled event").join(", ")} {deleteUsers.length === 1 ? "sells" : "sell"}{" "}
              booths from this hall. Pick another hall on {deleteUsers.length === 1 ? "that event's" : "those events'"}{" "}
              Exhibitor Floor tab first, then delete it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default ExpoHallsScreen;
