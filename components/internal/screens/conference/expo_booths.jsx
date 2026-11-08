"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Map as MapIcon, SquarePen, Store } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { ActionMenu, Button, LogoLoading } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { currency } from "@/components/internal/screens/tickets/constants";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listEvents } from "@/lib/supabase/events";
import { listLiveBooths } from "@/lib/supabase/hall_maps";
import { listExpoHalls } from "@/lib/supabase/expo_halls";
import { BOOTH_SIZE_CLASSES, isBooth, normaliseBoothFields } from "@/lib/event_design";
import { DEMO_BOOTH_STATE, DEMO_HALL } from "./demo_floor_plan";
import { HALLS_TAB, eventsByHall } from "./expo_halls";
import {
  BOOTH_STATE_FILTER_OPTIONS,
  BOOTH_STATE_MAP,
  boothFootprint,
  boothStateOf,
  loadEventBoothState,
} from "./expo/booth_state";
import { assignBoothTo, boothEventActions } from "./expo/booth_actions";
import { AssignBoothDialog } from "./expo/assign_dialog";
import { BoothDetail } from "./expo/booth_detail";

// Expo Booths: every sellable booth across the project's halls (events.hall_booths), with live per-event state when an
// event is picked, and a full edit page per booth. Booth geometry is drawn on Floor Plan & Booths.

const SIZE_OPTIONS = [{ value: "all", label: "All sizes" }, ...BOOTH_SIZE_CLASSES.map((s) => ({ value: s, label: s }))];
const byCode = (a, b) =>
  a.hallName.localeCompare(b.hallName) || a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" });

// Stable empty list, so a hall with no events doesn't hand the edit page a new array every render.
const NO_EVENTS = [];

const DEMO_EVENT = { id: "demo-event", name: "Product Summit 2026", date: "2026-05-14", expo: { hallMapId: DEMO_HALL.hallMapId } };

// Demo rows straight from the sample hall's booth instances.
function demoData() {
  const booths = DEMO_HALL.objects.filter(isBooth).map((o, i) => ({
    id: o.id,
    hallMapId: DEMO_HALL.hallMapId,
    code: o.label,
    name: o.label,
    hall: normaliseBoothFields(o.booth).zone,
    sizeClass: normaliseBoothFields(o.booth).sizeClass,
    price: normaliseBoothFields(o.booth).price,
    sortOrder: i,
  }));
  const byBooth = new Map(
    Object.entries(DEMO_BOOTH_STATE)
      .filter(([, s]) => s.status !== "held")
      .map(([id, s]) => [id, { id: `a-${id}`, boothId: id, status: s.status, exhibitorName: s.exhibitorName || "", price: 0 }]),
  );
  const taken = new Set(Object.keys(DEMO_BOOTH_STATE));
  return { booths, state: { byBooth, taken } };
}

export function ExpoBoothsScreen({ demo = false }) {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord, openRecordInTab } = useWorkspaceUrl();
  const demoSeed = useMemo(() => (demo ? demoData() : null), [demo]);
  const [halls, setHalls] = useState(() => (demo ? [{ id: DEMO_HALL.id, plan: DEMO_HALL, map: null }] : []));
  const [rawBooths, setRawBooths] = useState(() => demoSeed?.booths || []);
  const [events, setEvents] = useState(() => (demo ? [DEMO_EVENT] : []));
  const [loading, setLoading] = useState(!demo);
  const [reloadKey, setReloadKey] = useState(0);
  const [eventId, setEventId] = useState(demo ? DEMO_EVENT.id : "all");
  const [eventState, setEventState] = useState(() => (demo ? { forEvent: DEMO_EVENT.id, ...demoSeed.state } : null));
  const [stateKey, setStateKey] = useState(0);
  const [hallFilter, setHallFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [assignTarget, setAssignTarget] = useState(null);

  useEffect(() => {
    if (demo) return undefined;
    let alive = true;
    Promise.all([listExpoHalls(projectId), listEvents(projectId)]).then(async ([hallRows, eventRows]) => {
      const list = hallRows ?? [];
      const booths = await listLiveBooths(list.map((h) => h.plan?.hallMapId ?? h.map?.id).filter(Boolean));
      if (!alive) return;
      setHalls(list);
      setEvents(eventRows ?? []);
      setRawBooths(booths ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, demo, reloadKey]);

  const selling = useMemo(() => eventsByHall(events), [events]);
  const event = eventId !== "all" ? events.find((e) => e.id === eventId) || null : null;

  useEffect(() => {
    if (demo || !event) return undefined;
    let alive = true;
    loadEventBoothState(event.id).then((state) => {
      if (!alive) return;
      if (!state) toast.error("Couldn't load booth status for this event.");
      setEventState({ forEvent: event.id, ...(state || { byBooth: new Map(), taken: new Set() }) });
    });
    return () => {
      alive = false;
    };
  }, [demo, event, stateKey]);

  const live = eventState?.forEvent === eventId ? eventState : null;

  // Hall booth rows joined with their plan instance (real size) and hall name.
  const booths = useMemo(() => {
    const hallByMap = new Map();
    for (const h of halls) {
      const mapId = h.plan?.hallMapId ?? h.map?.id;
      if (mapId) hallByMap.set(mapId, { hall: h, objects: new Map((h.plan?.objects || []).map((o) => [o.id, o])) });
    }
    return rawBooths
      .map((b) => {
        const entry = hallByMap.get(b.hallMapId);
        const inst = entry?.objects.get(b.id);
        return {
          id: b.id,
          code: b.code || b.name || "",
          zone: b.hall,
          sizeClass: b.sizeClass,
          price: b.price,
          hallMapId: b.hallMapId,
          hall: entry?.hall || null,
          hallName: entry?.hall.plan?.name || entry?.hall.map?.name || "Hall",
          planId: entry?.hall.plan?.id || null,
          widthM: inst?.width_m ?? null,
          depthM: inst?.depth_m ?? null,
          unit: entry?.hall.plan?.unit || "m",
        };
      })
      .sort(byCode);
  }, [halls, rawBooths]);

  const eventOptions = useMemo(
    () => [
      { value: "all", label: "All events" },
      ...events
        .filter((e) => e.expo?.hallMapId && booths.some((b) => b.hallMapId === e.expo.hallMapId))
        .map((e) => ({ value: e.id, label: e.name || "Untitled event" })),
    ],
    [events, booths],
  );

  const hallOptions = useMemo(
    () => [
      { value: "all", label: "All halls" },
      ...halls
        .filter((h) => booths.some((b) => b.hall === h))
        .map((h) => ({ value: h.plan?.hallMapId ?? h.map?.id, label: h.plan?.name || h.map?.name || "Hall" })),
    ],
    [halls, booths],
  );

  const scoped = useMemo(
    () =>
      booths.filter((b) => {
        if (event) return b.hallMapId === event.expo?.hallMapId;
        return hallFilter === "all" || b.hallMapId === hallFilter;
      }),
    [booths, event, hallFilter],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((b) => {
      if (sizeFilter !== "all" && b.sizeClass !== sizeFilter) return false;
      if (live && statusFilter !== "all" && boothStateOf(b.id, live).key !== statusFilter) return false;
      if (q) {
        const exhibitor = live ? boothStateOf(b.id, live).assignment?.exhibitorName || "" : "";
        if (!`${b.code} ${b.zone} ${b.hallName} ${exhibitor}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [scoped, sizeFilter, statusFilter, search, live]);

  const pager = usePagination(filtered, { resetKey: `${eventId}|${hallFilter}|${sizeFilter}|${statusFilter}|${search}` });

  const stats = useMemo(() => {
    const value = scoped.reduce((n, b) => n + (b.price || 0), 0);
    if (!event) {
      return [
        { label: "Booths", value: String(scoped.length), footer: `Across ${new Set(scoped.map((b) => b.hallMapId)).size} halls` },
        { label: "Floor value", value: currency(value), footer: "At list price" },
        { label: "Average price", value: currency(scoped.length ? Math.round(value / scoped.length) : 0), footer: "Per booth" },
        { label: "Selling events", value: String(eventOptions.length - 1), footer: "With a hall on sale" },
      ];
    }
    const counts = { available: 0, held: 0, sold: 0, comp: 0, blocked: 0 };
    let revenue = 0;
    for (const b of scoped) {
      const s = boothStateOf(b.id, live);
      counts[s.key] += 1;
      if (s.key === "sold" || s.key === "comp") revenue += s.assignment?.price || 0;
    }
    return [
      { label: "Booths", value: String(scoped.length), footer: scoped[0]?.hallName || "No hall" },
      { label: "Taken", value: String(counts.sold + counts.comp), footer: `${counts.sold} sold · ${counts.comp} assigned` },
      { label: "Available", value: String(counts.available), footer: `${counts.held} held · ${counts.blocked} blocked` },
      { label: "Booth revenue", value: currency(revenue), footer: "Sold and assigned" },
    ];
  }, [scoped, event, live, eventOptions.length]);

  const openPlan = (b) => b.planId && openRecordInTab?.(b.planId, HALLS_TAB);
  const refreshState = () => setStateKey((k) => k + 1);

  const selected = recordId ? booths.find((b) => b.id === recordId) || null : null;
  if (recordId && !demo) {
    if (loading) {
      return (
        <div className="flex h-full min-h-[480px] items-center justify-center">
          <LogoLoading size={80} aria-label="Loading booth" />
        </div>
      );
    }
    if (selected) {
      return (
        <>
          <BoothDetail
            key={selected.id}
            booth={selected}
            events={selling.get(selected.hallMapId) || NO_EVENTS}
            refreshKey={stateKey}
            onBack={closeRecord}
            onSaved={() => setReloadKey((k) => k + 1)}
            onOpenPlan={openPlan}
            onAssign={setAssignTarget}
          />
          <AssignBoothDialog
            key={assignTarget ? `${assignTarget.event.id}-${assignTarget.booth.id}` : "assign-closed"}
            target={assignTarget}
            onOpenChange={(o) => !o && setAssignTarget(null)}
            onAssign={async (t, exhibitor) => {
              const ok = await assignBoothTo(t.event, t.booth, exhibitor);
              if (ok) refreshState();
              return ok;
            }}
          />
        </>
      );
    }
  }

  const columns = [
    {
      key: "booth",
      header: "Booth",
      render: (b) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">{b.code || "Unnumbered"}</span>
          <span className="truncate text-xs text-text-secondary">{[b.hallName, b.zone].filter(Boolean).join(" · ")}</span>
        </div>
      ),
    },
    {
      key: "size",
      header: "Size",
      render: (b) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-foreground">{b.sizeClass}</span>
          {boothFootprint(b) ? <span className="text-xs tabular-nums text-text-tertiary">{boothFootprint(b)}</span> : null}
        </div>
      ),
    },
    ...(live
      ? [
          {
            key: "status",
            header: "Status",
            render: (b) => <StatusPill status={boothStateOf(b.id, live).key} map={BOOTH_STATE_MAP} />,
          },
          {
            key: "exhibitor",
            header: "Exhibitor",
            render: (b) => {
              const a = boothStateOf(b.id, live).assignment;
              return a && a.status !== "blocked" ? (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm text-foreground">{a.exhibitorName || "Exhibitor"}</span>
                  {a.exhibitorEmail ? <span className="truncate text-xs text-text-tertiary">{a.exhibitorEmail}</span> : null}
                </div>
              ) : (
                <span className="text-sm text-text-tertiary">—</span>
              );
            },
          },
        ]
      : [
          {
            key: "events",
            header: "Events",
            render: (b) => {
              const list = selling.get(b.hallMapId) || [];
              return (
                <span className="text-sm text-text-secondary">
                  {list.length ? (list.length === 1 ? list[0].name : `${list.length} events`) : "Not on sale"}
                </span>
              );
            },
          },
        ]),
    {
      key: "price",
      header: "Price",
      align: "right",
      className: "text-right font-semibold tabular-nums text-foreground dark:text-white",
      render: (b) => (b.price ? currency(b.price) : "—"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (b) => (
        <div onClick={(e) => e.stopPropagation()} role="presentation">
          <ActionMenu
            label={`Actions for booth ${b.code}`}
            items={[
              { icon: SquarePen, label: "Edit booth", onSelect: () => openRecord(b.id) },
              b.planId && { icon: MapIcon, label: "Open on floor plan", onSelect: () => openPlan(b) },
              ...(event && live && !demo
                ? (() => {
                    const items = boothEventActions({
                      event,
                      booth: b,
                      state: boothStateOf(b.id, live),
                      onAssign: setAssignTarget,
                      onDone: refreshState,
                    });
                    return items.length ? [{ separator: true }, ...items] : [];
                  })()
                : []),
            ].filter(Boolean)}
          />
        </div>
      ),
    },
  ];

  const noHalls = !loading && !halls.length;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Expo Booths"
        description="Every booth you sell across your exhibitor halls. Pick an event to see what's sold, held or free — and assign or block booths by hand."
        actions={
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => openRecordInTab?.(null, HALLS_TAB)}
          >
            <MapIcon className="h-4 w-4" /> Floor plans
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={eventId} onValueChange={setEventId} options={eventOptions} height="h-9" />
          {event ? (
            <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={BOOTH_STATE_FILTER_OPTIONS} height="h-9" />
          ) : (
            <FilterDropdown value={hallFilter} onValueChange={setHallFilter} options={hallOptions} height="h-9" />
          )}
          <FilterDropdown value={sizeFilter} onValueChange={setSizeFilter} options={SIZE_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder={event ? "Search booths or exhibitors…" : "Search booths…"} />
      </Toolbar>

      {loading || (event && !live) ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading booths" />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(b) => b.id}
            onRowClick={demo ? undefined : (b) => openRecord(b.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Store}
                  title={noHalls ? "No exhibitor halls yet" : booths.length ? "No booths match" : "No booths yet"}
                  description={
                    noHalls || !booths.length
                      ? "Draw a hall under Floor Plan & Booths and drop booths onto it — they show up here once it's saved."
                      : "Try another event, hall, size or search."
                  }
                  action={
                    noHalls || !booths.length ? (
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => openRecordInTab?.(null, HALLS_TAB)}
                      >
                        <MapIcon className="h-4 w-4" /> Go to floor plans
                      </Button>
                    ) : null
                  }
                />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="booths" />
        </div>
      )}

      <AssignBoothDialog
        key={assignTarget ? `${assignTarget.event.id}-${assignTarget.booth.id}` : "assign-closed"}
        target={assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        onAssign={async (t, exhibitor) => {
          const ok = await assignBoothTo(t.event, t.booth, exhibitor);
          if (ok) refreshState();
          return ok;
        }}
      />
    </MainScreenWrapper>
  );
}

export default ExpoBoothsScreen;
