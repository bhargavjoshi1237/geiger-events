"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarX2, Cpu, Layers, Plus, Radio, ScanLine, Wand2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, SegmentedTabs, StatsBar } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { LogoLoading } from "@geiger/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listEvents } from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";
import { listEntryPointsByEvent } from "@/lib/supabase/nfc";
import {
  getBadgeStats,
  listBadges,
  listBatches,
  listTapSummary,
} from "@/lib/supabase/smart_badges";
import { listPassAttendees } from "@/lib/passes/attendees";
import { isBound, liveBadgesByHolder } from "@/lib/smart_badges/roster";

import { BadgesTab } from "./smart_badges/badges_tab";
import { BatchesTab } from "./smart_badges/batches_tab";
import { BindingDesk } from "./smart_badges/binding_desk";
import { EntryPointsTab } from "./smart_badges/entry_points_tab";
import { BadgeDrawer } from "./smart_badges/badge_drawer";
import { AddBadgesDialog } from "./smart_badges/add_badges_dialog";
import { AutoAssignDialog } from "./smart_badges/auto_assign_dialog";
import { startOfToday } from "./smart_badges/constants";

const POLL_MS = 30000;

const EMPTY = {
  badges: [],
  batches: [],
  points: [],
  roster: [],
  tapSummary: new Map(),
  stats: null,
};

export function SmartBadgesScreen() {
  const { projectId } = useProject();
  const { setTab: openScreen } = useWorkspaceUrl();
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState("");
  const [data, setData] = useState(EMPTY);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState("badges");
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [assignBatch, setAssignBatch] = useState(null);
  const eventIdRef = useRef("");
  const requestRef = useRef(0);

  // Everything the screen shows for one event, in one round. Stale responses (a newer event was picked) are dropped.
  const loadEvent = useCallback(
    async (id, { quiet = false } = {}) => {
      requestRef.current += 1;
      const n = requestRef.current;
      if (!id) {
        setData(EMPTY);
        setLoadingEvent(false);
        return;
      }
      // A refresh after an action keeps the current rows on screen instead of flashing the loader.
      if (!quiet) setLoadingEvent(true);
      const [badges, batches, points, tapSummary, stats, roster] = await Promise.all([
        listBadges(id),
        listBatches(id),
        listEntryPointsByEvent(id),
        listTapSummary(id),
        getBadgeStats(id, startOfToday()),
        listPassAttendees(id, projectId),
      ]);
      if (requestRef.current !== n) return;
      setData({
        badges: badges ?? [],
        batches: batches ?? [],
        points: points ?? [],
        roster: roster ?? [],
        tapSummary: tapSummary ?? new Map(),
        stats,
      });
      setLoadingEvent(false);
    },
    [projectId],
  );

  useEffect(() => {
    let alive = true;
    listEvents(projectId).then((rows) => {
      if (!alive) return;
      const list = rows ?? [];
      setEvents(list);
      const next = list.some((e) => e.id === eventIdRef.current) ? eventIdRef.current : list[0]?.id || "";
      eventIdRef.current = next;
      setEventId(next);
      loadEvent(next);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId, loadEvent]);

  // Taps arrive from readers, so the live counters refresh on their own.
  useEffect(() => {
    if (!eventId) return undefined;
    const timer = setInterval(() => {
      const id = eventIdRef.current;
      Promise.all([listTapSummary(id), getBadgeStats(id, startOfToday())]).then(([tapSummary, stats]) => {
        if (eventIdRef.current !== id) return;
        setData((prev) => ({
          ...prev,
          tapSummary: tapSummary ?? prev.tapSummary,
          stats: stats ?? prev.stats,
        }));
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [eventId]);

  const pickEvent = (id) => {
    eventIdRef.current = id;
    setEventId(id);
    setOpenId(null);
    loadEvent(id);
  };

  const refresh = useCallback(() => loadEvent(eventIdRef.current, { quiet: true }), [loadEvent]);

  const eventList = useMemo(() => events ?? [], [events]);
  const event = eventList.find((e) => e.id === eventId) || null;
  const { badges, batches, points, roster, tapSummary, stats } = data;

  const rosterByKey = useMemo(() => new Map(roster.map((p) => [p.key, p])), [roster]);
  const liveByHolder = useMemo(() => liveBadgesByHolder(badges), [badges]);
  const batchesById = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches]);
  const pointsById = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const openBadge = openId ? badges.find((b) => b.id === openId) || null : null;

  const statCards = useMemo(() => {
    const bound = badges.filter((b) => b.status === "active" && isBound(b)).length;
    const spare = badges.filter((b) => b.status === "unassigned").length;
    const active = stats?.activeToday ?? 0;
    const pct = bound ? Math.round((active / bound) * 100) : 0;
    return [
      {
        label: "Badges issued",
        value: badges.length.toLocaleString("en-US"),
        footer: `${bound.toLocaleString("en-US")} bound · ${spare.toLocaleString("en-US")} spare`,
      },
      {
        label: "Active today",
        value: active.toLocaleString("en-US"),
        footer: bound ? `${pct}% of bound badges` : "Badges tapped since midnight",
      },
      {
        label: "Taps today",
        value: (stats?.tapsToday ?? 0).toLocaleString("en-US"),
        footer: stats?.rejectedToday ? `${stats.rejectedToday} refused at readers` : "Across every reader",
      },
      {
        label: "Leads captured",
        value: (stats?.leads ?? 0).toLocaleString("en-US"),
        footer: "By exhibitor taps",
      },
    ];
  }, [badges, stats]);

  const loading = events === null;
  const noEvents = !loading && !eventList.length;
  const spareCount = badges.filter((b) => b.status === "unassigned").length;
  const goRfid = () => {
    if (typeof openScreen === "function") openScreen("RFID / NFC");
  };

  const tabSwitch = (
    <SegmentedTabs
      className="w-fit sm:w-fit"
      value={tab}
      onChange={setTab}
      tabs={[
        { value: "badges", label: "Badges", icon: Cpu },
        { value: "batches", label: "Batches", icon: Layers },
        { value: "desk", label: "Binding desk", icon: ScanLine },
        { value: "points", label: "Entry points", icon: Radio },
      ]}
    />
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Smart Badges"
        description="NFC chip badges bound to every attendee — issue them in bulk, follow each tap across gates and sessions, and let exhibitors tap to collect leads."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={eventId} onValueChange={pickEvent} disabled={!eventList.length}>
              <SelectTrigger className="h-9 w-full bg-surface-card sm:w-56">
                <SelectValue placeholder={loading ? "Loading events…" : "Pick an event"} />
              </SelectTrigger>
              <SelectContent>
                {eventList.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name || "Untitled event"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              disabled={!eventId || !spareCount}
              onClick={() => setAssignBatch("all")}
            >
              <Wand2 className="h-4 w-4" /> Auto-assign
            </Button>
            <Button
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!eventId}
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4" /> Add badges
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-20">
          <LogoLoading size={56} label="Loading Smart Badges" />
        </div>
      ) : noEvents ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CalendarX2}
            title="No events yet"
            description="Smart badges are issued per event. Create an event first, then load its badges here."
          />
        </div>
      ) : (
        <>
          <StatsBar stats={statCards} />

          {/* Badges places the switcher in its own toolbar row. */}
          {tab !== "badges" ? tabSwitch : null}

          {tab === "badges" ? (
            <BadgesTab
              tabs={tabSwitch}
              badges={badges}
              batches={batches}
              batchesById={batchesById}
              rosterByKey={rosterByKey}
              tapSummary={tapSummary}
              loading={loadingEvent}
              eventName={event?.name}
              onOpen={(b) => setOpenId(b.id)}
              onAdd={() => setAdding(true)}
              onChanged={refresh}
            />
          ) : tab === "batches" ? (
            <BatchesTab
              batches={batches}
              badges={badges}
              batchesById={batchesById}
              rosterByKey={rosterByKey}
              loading={loadingEvent}
              eventName={event?.name}
              onAdd={() => setAdding(true)}
              onAssign={(id) => setAssignBatch(id)}
              onChanged={refresh}
            />
          ) : tab === "desk" ? (
            loadingEvent ? (
              <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
                <LogoLoading size={48} label="Loading roster" />
              </div>
            ) : (
              <BindingDesk
                key={eventId}
                eventId={eventId}
                roster={roster}
                batches={batches}
                liveByHolder={liveByHolder}
                onChanged={refresh}
              />
            )
          ) : (
            <EntryPointsTab
              key={eventId}
              eventId={eventId}
              projectId={projectId}
              event={event}
              points={points}
              userId={userId}
              loading={loadingEvent}
              onChanged={refresh}
              onOpenRfid={goRfid}
            />
          )}
        </>
      )}

      <BadgeDrawer
        badge={openBadge}
        onOpenChange={(o) => !o && setOpenId(null)}
        badges={badges}
        batches={batches}
        pointsById={pointsById}
        roster={roster}
        rosterByKey={rosterByKey}
        liveByHolder={liveByHolder}
        eventId={eventId}
        onChanged={refresh}
        onOpenBadge={setOpenId}
      />

      <AddBadgesDialog
        open={adding}
        onOpenChange={setAdding}
        eventId={eventId}
        projectId={projectId}
        userId={userId}
        batches={batches}
        badges={badges}
        roster={roster}
        onDone={refresh}
      />

      <AutoAssignDialog
        open={!!assignBatch}
        onOpenChange={(o) => !o && setAssignBatch(null)}
        eventId={eventId}
        batches={batches}
        badges={badges}
        roster={roster}
        initialBatchId={assignBatch}
        onDone={refresh}
      />
    </MainScreenWrapper>
  );
}

export default SmartBadgesScreen;
