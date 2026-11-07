"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, CloudOff, GitCompareArrows, History, Settings2, Smartphone } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, SegmentedTabs, StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { LogoLoading } from "@geiger/ui";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { getCheckinSettings } from "@/lib/supabase/checkin";
import {
  countOfflineAdmits,
  listCheckinConflicts,
  listCheckinDevices,
  listCheckinSyncLog,
} from "@/lib/supabase/checkin_offline";
import { EventPicker } from "./offline/event_picker";
import { DevicesTab } from "./offline/devices_tab";
import { ConflictsTab } from "./offline/conflicts_tab";
import { SyncLogTab } from "./offline/sync_log_tab";
import { OfflineSettings, offlineOnForEvent, offlineSlice } from "./offline/offline_settings";
import { ONLINE_MS, staffRouteUrl } from "./offline/shared";

const REFRESH_MS = 15000;

export function OfflineCheckinScreen() {
  const { projectId } = useProject();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [config, setConfig] = useState(null);
  const [configRev, setConfigRev] = useState(0);
  const [tab, setTab] = useState("devices");
  const [data, setData] = useState({ devices: [], conflicts: [], log: [], offlineAdmits: 0 });
  const [loadedFor, setLoadedFor] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    Promise.all([listEvents(projectId), getCheckinSettings(projectId)]).then(([rows, settings]) => {
      if (!alive) return;
      const list = rows ?? [];
      setEvents(list);
      setEventId((cur) => cur || list[0]?.id || "");
      setConfig(settings?.config || {});
      setLoadingEvents(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Live: the device list, conflicts and sync log refresh while the screen is open.
  useEffect(() => {
    if (!eventId) return undefined;
    let alive = true;
    const load = () =>
      Promise.all([
        listCheckinDevices(eventId),
        listCheckinConflicts(eventId),
        listCheckinSyncLog(eventId),
        countOfflineAdmits(eventId),
      ]).then(([devices, conflicts, log, offlineAdmits]) => {
        if (!alive) return;
        setData({ devices: devices ?? [], conflicts: conflicts ?? [], log: log ?? [], offlineAdmits: offlineAdmits ?? 0 });
        setLoadedFor(eventId);
        setNow(Date.now());
      });
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [eventId]);

  const event = events.find((e) => e.id === eventId) || null;
  const loading = !!eventId && loadedFor !== eventId;
  const slice = useMemo(() => offlineSlice(config || {}), [config]);
  const offlineOn = offlineOnForEvent(slice, eventId);
  const devicesById = useMemo(() => new Map(data.devices.map((d) => [d.deviceId, d])), [data.devices]);
  const openConflicts = data.conflicts.filter((c) => c.status === "open").length;

  const stats = useMemo(() => {
    const online = data.devices.filter((d) => d.lastSeenAt && now - new Date(d.lastSeenAt).getTime() <= ONLINE_MS).length;
    const queued = data.devices.reduce((s, d) => s + d.queuedCount, 0);
    return [
      { label: "Devices online", value: `${online} / ${data.devices.length}`, footer: "Heard from in the last 2 minutes" },
      { label: "Queued on devices", value: queued.toLocaleString("en-US"), footer: "Scans waiting to sync" },
      { label: "Open conflicts", value: String(openConflicts), footer: "Need review" },
      { label: "Admitted offline", value: data.offlineAdmits.toLocaleString("en-US"), footer: "Synced from devices" },
    ];
  }, [data, now, openConflicts]);

  const openScanner = () => {
    const url = staffRouteUrl("checkin", eventId);
    if (url) window.open(url, "_blank", "noopener");
  };

  const tabs = [
    { value: "devices", label: "Devices", icon: Smartphone },
    { value: "conflicts", label: openConflicts ? `Conflicts (${openConflicts})` : "Conflicts", icon: GitCompareArrows },
    { value: "log", label: "Sync log", icon: History },
    { value: "settings", label: "Settings", icon: Settings2 },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Offline Check-in"
        description="Keep scanning when the venue network drops. Devices hold the guest list, queue check-ins and sync when signal returns; tickets admitted twice are flagged for review."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!eventId} onClick={openScanner}>
            <ExternalLink className="h-4 w-4" /> Open scanner
          </Button>
        }
      />

      {loadingEvents ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} label="Loading offline check-in" />
        </div>
      ) : !events.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CloudOff}
            title="No events yet"
            description="Create an event, then come back to prepare its scanners for offline check-in."
          />
        </div>
      ) : (
        <>
          <StatsBar stats={stats} />

          <Toolbar>
            <div className="flex flex-wrap items-center gap-2">
              <EventPicker events={events} value={eventId} onChange={setEventId} />
              <span
                className={
                  offlineOn
                    ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                    : "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card px-2.5 py-1 text-xs font-medium text-text-secondary"
                }
              >
                Offline mode {offlineOn ? "on" : "off"}
              </span>
            </div>
            <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />
          </Toolbar>

          {loading && tab !== "settings" ? (
            <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
              <LogoLoading size={48} label="Loading devices" />
            </div>
          ) : tab === "devices" ? (
            <DevicesTab
              devices={data.devices}
              now={now}
              refreshMinutes={slice.refreshMinutes}
              onChange={(devices) => setData((d) => ({ ...d, devices }))}
              onOpenScanner={eventId ? openScanner : null}
            />
          ) : tab === "conflicts" ? (
            <ConflictsTab
              conflicts={data.conflicts}
              devicesById={devicesById}
              onChange={(conflicts) => setData((d) => ({ ...d, conflicts }))}
            />
          ) : tab === "log" ? (
            <SyncLogTab log={data.log} devicesById={devicesById} resetKey={eventId} />
          ) : (
            <OfflineSettings
              key={configRev}
              config={config || {}}
              eventId={eventId}
              eventName={event?.name || ""}
              onSaved={(next) => {
                setConfig(next);
                setConfigRev((n) => n + 1);
              }}
            />
          )}
        </>
      )}
    </MainScreenWrapper>
  );
}

export default OfflineCheckinScreen;
