"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Gauge, Info, Maximize, Minimize, RefreshCw } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { LogoLoading } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { getCheckinSettings } from "@/lib/supabase/checkin";
import {
  getCheckinTimeline,
  listCapacityOverrides,
  listCapacityRules,
  listZoneOccupancy,
  saveCapacityRule,
} from "@/lib/supabase/checkin_capacity";
import { bucketSeries, buildZoneCards } from "@/lib/checkin/capacity";
import { EventPicker } from "./offline/event_picker";
import { ZoneCard } from "./capacity/zone_card";
import { FLOW_COLOR_VARS, FlowLegend } from "./capacity/flow_sparkline";
import { OverrideLog } from "./capacity/override_log";
import { withDefaults } from "./constants";

const REFRESH_MS = 15000;
const BUCKET_MINUTES = 15;
const EMPTY = { rules: [], occupancy: [], timeline: [], overrides: [] };

export function CapacityControlScreen() {
  const { projectId } = useProject();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [defaultReentry, setDefaultReentry] = useState("once");
  const [data, setData] = useState(EMPTY);
  const [loadedFor, setLoadedFor] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [desk, setDesk] = useState(false);
  const deskRef = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listEvents(projectId), getCheckinSettings(projectId)]).then(([rows, settings]) => {
      if (!alive) return;
      const list = rows ?? [];
      setEvents(list);
      setEventId((cur) => cur || list[0]?.id || "");
      const rule = withDefaults(settings?.config || {}, "checkinApp").reentry;
      setDefaultReentry(rule === "once" ? "once" : "multi");
      setLoadingEvents(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const load = useCallback(async (id) => {
    const [rules, occupancy, timeline, overrides] = await Promise.all([
      listCapacityRules(id),
      listZoneOccupancy(id),
      getCheckinTimeline(id, { hours: 6, bucketMinutes: BUCKET_MINUTES }),
      listCapacityOverrides(id),
    ]);
    return { rules: rules ?? [], occupancy: occupancy ?? [], timeline: timeline ?? [], overrides: overrides ?? [] };
  }, []);

  // Live, like Real-time Attendance: occupancy, flow and overrides poll while the screen is open.
  useEffect(() => {
    if (!eventId) return undefined;
    let alive = true;
    const tick = () =>
      load(eventId).then((next) => {
        if (!alive) return;
        setData(next);
        setLoadedFor(eventId);
        setUpdatedAt(new Date().toISOString());
      });
    tick();
    const t = setInterval(tick, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [eventId, load]);

  const refresh = async () => {
    if (!eventId) return;
    setRefreshing(true);
    const next = await load(eventId);
    setData(next);
    setUpdatedAt(new Date().toISOString());
    setRefreshing(false);
  };

  // Ops-desk mode: the whole board on one screen, full-screen where the browser allows it.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setDesk(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setDesk(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const enterDesk = () => {
    setDesk(true);
    deskRef.current?.requestFullscreen?.().catch(() => {});
  };
  const leaveDesk = () => {
    setDesk(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };

  const event = events.find((e) => e.id === eventId) || null;
  const loading = !!eventId && loadedFor !== eventId;
  const zones = event?.checkinGates?.zones;
  const cards = useMemo(
    () => buildZoneCards({ zones: Array.isArray(zones) ? zones : [], rules: data.rules, occupancy: data.occupancy }),
    [zones, data.rules, data.occupancy],
  );

  const saveRule = async (card, values) => {
    const saved = await saveCapacityRule({
      projectId,
      eventId,
      // Update the row that already governs this area, even if it was saved under an older zone id.
      zoneKey: card.rule?.zoneKey ?? card.key,
      zoneName: card.venue ? "" : card.name,
      ...values,
    });
    if (!saved) {
      toast.error("Couldn't save the cap.");
      return false;
    }
    setData((d) => ({ ...d, rules: [...d.rules.filter((r) => r.zoneKey !== saved.zoneKey), saved] }));
    toast.success(saved.hardCap === null ? `${card.name} has no cap.` : `${card.name} capped at ${saved.hardCap.toLocaleString("en-US")}.`);
    return true;
  };

  const stats = useMemo(() => {
    const venue = cards[0];
    const warn = cards.filter((c) => c.level === "warn").length;
    const full = cards.filter((c) => c.level === "full" || c.level === "over").length;
    const overCap = cards.reduce((s, c) => s + c.overCapacityAdmits, 0);
    return [
      {
        label: "In venue",
        value: (venue?.occupancy ?? 0).toLocaleString("en-US"),
        footer: venue?.cap !== null && venue?.cap !== undefined ? `Cap ${venue.cap.toLocaleString("en-US")}` : "No venue cap",
      },
      { label: "Near capacity", value: String(warn), footer: "Past their warning level" },
      { label: "Full", value: String(full), footer: "At or over the hard cap" },
      { label: "Overrides", value: String(data.overrides.length), footer: overCap ? `${overCap} offline over cap` : "Supervisor admits past a cap" },
    ];
  }, [cards, data.overrides.length]);

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })
    : "";

  return (
    <MainScreenWrapper className={FLOW_COLOR_VARS}>
      <ScreenHeader
        title="Capacity Control"
        description="Live occupancy per zone against its hard cap. Scanners refuse entry at the cap unless a supervisor overrides with a reason."
        actions={
          <>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              disabled={!eventId || refreshing}
              onClick={refresh}
            >
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!eventId} onClick={enterDesk}>
              <Maximize className="h-4 w-4" /> Ops desk
            </Button>
          </>
        }
      />

      {loadingEvents ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} label="Loading capacity" />
        </div>
      ) : !events.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={Gauge} title="No events yet" description="Create an event to set capacity caps for its venue and zones." />
        </div>
      ) : (
        <>
          <StatsBar stats={stats} />

          <Toolbar>
            <EventPicker events={events} value={eventId} onChange={setEventId} />
            <span className="ml-auto text-xs text-text-tertiary">
              {updatedLabel ? `Updated ${updatedLabel} · refreshes every 15s` : ""}
            </span>
          </Toolbar>

          <div
            ref={deskRef}
            className={cn(desk && `fixed inset-0 z-50 overflow-y-auto bg-background p-6 sm:p-10 ${FLOW_COLOR_VARS}`)}
          >
            {desk ? (
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-2xl font-semibold text-foreground">{event?.name || "Capacity"}</p>
                  <p className="text-sm text-text-secondary">{updatedLabel ? `Updated ${updatedLabel}` : "Live occupancy"}</p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={leaveDesk}
                >
                  <Minimize className="h-4 w-4" /> Exit
                </Button>
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
                <LogoLoading size={48} label="Loading occupancy" />
              </div>
            ) : (
              <div className="space-y-4">
                <FlowLegend bucketMinutes={BUCKET_MINUTES} />
                <div className={cn("grid gap-4", desk ? "md:grid-cols-2 2xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3")}>
                  {cards.map((card) => (
                    <ZoneCard
                      key={card.key}
                      card={card}
                      series={bucketSeries(data.timeline, card.nameKey, BUCKET_MINUTES)}
                      bucketMinutes={BUCKET_MINUTES}
                      defaultReentry={defaultReentry}
                      eventCapacity={event?.capacity}
                      onSave={saveRule}
                      large={desk}
                    />
                  ))}
                </div>
                {!desk && cards.length === 1 ? (
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-subtle px-4 py-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                    <p className="text-sm text-text-secondary">
                      Only the venue is tracked. Add zones in the event editor under Check-in → Multi-gate &amp; Zones to cap
                      areas like VIP or a hall; scanners pick the zone they&apos;re working.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {!loading ? <OverrideLog overrides={data.overrides} resetKey={eventId} /> : null}
        </>
      )}
    </MainScreenWrapper>
  );
}

export default CapacityControlScreen;
