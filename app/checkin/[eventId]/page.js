"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, DoorOpen, LogIn, LogOut, Search, UserCheck, Loader2 } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { IconInput } from "@/components/internal/shared/icon_input";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { getEvent } from "@/lib/supabase/events";
import { checkinStats } from "@/lib/supabase/checkin";
import { rowKey } from "@/lib/checkin/scan";
import { capFor } from "@/lib/checkin/offline/lookup";
import { describeOutcome } from "@/lib/checkin/offline/feedback";
import { useCheckinEngine } from "@/lib/checkin/offline/use_checkin_engine";
import { useCheckinServiceWorker } from "@/lib/checkin/offline/sw_client";
import { AccessGate } from "@/components/checkin_routes/access_gate";
import { RouteShell } from "@/components/checkin_routes/route_shell";
import { QrScanner } from "@/components/checkin_routes/qr_scanner";
import { OfflineBanner } from "@/components/checkin_routes/offline_banner";
import { CapacityOverrideDialog } from "@/components/checkin_routes/capacity_override_dialog";
import { OccupancyChip, ScanFeedback, buzz } from "@/components/checkin_routes/scan_feedback";

const MODES = [
  { label: "Entry", value: "entry", icon: LogIn },
  { label: "Exit", value: "exit", icon: LogOut },
];

const enabledOnly = (list) => (Array.isArray(list) ? list.filter((x) => x && x.enabled !== false) : []);

function Scanner({ eventId, code, role, exit, event }) {
  const { engine, status } = useCheckinEngine({ eventId, code, role, route: "checkin" });
  const [stats, setStats] = useState(null);
  const [mode, setMode] = useState("entry");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [searchNote, setSearchNote] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [gate, setGate] = useState("");
  const [zone, setZone] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [scanOcc, setScanOcc] = useState(null);
  const [paused, setPaused] = useState(false);
  const fbTimer = useRef(null);

  // The event row needs a connection; the cached snapshot carries the same gates/zones/sessions offline.
  const meta = status.eventMeta;
  const sessions = event?.checkinSessions?.sessions || meta?.sessions || [];
  const gates = enabledOnly(event?.checkinGates?.gates || meta?.gates);
  const zones = enabledOnly(event?.checkinGates?.zones || meta?.zones);
  const online = status.online;

  const refreshStats = useCallback(() => {
    if (!online) return;
    checkinStats(eventId, code).then((s) => s && setStats(s));
  }, [eventId, code, online]);

  useEffect(() => {
    refreshStats();
    const t = setInterval(refreshStats, 15000);
    return () => clearInterval(t);
  }, [refreshStats]);

  // Live count for the area this scanner works: the newest of the last scan's answer and the heartbeat.
  const cap = capFor(status.caps, zone, sessionId);
  const capKey = cap ? cap.zoneKey || "" : null;
  const beat = cap ? status.occupancy.find((o) => (o.zoneKey || "") === capKey) : null;
  const occ =
    cap && scanOcc && scanOcc.key === capKey && scanOcc.beatAt === (status.occupancyAt || 0)
      ? scanOcc
      : beat
        ? { occupancy: beat.occupancy, cap: beat.hardCap, warnPct: beat.warnPct }
        : null;

  const show = (outcome, row, method) => {
    const next = describeOutcome(outcome);
    const overridable =
      outcome.kind === "capacity" && outcome.reason === "capacity_full" && outcome.canOverride && online;
    setFeedback({ ...next, override: overridable ? { ...outcome, row, method } : null });
    buzz(next.kind);
    if (fbTimer.current) clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setFeedback(null), overridable ? 9000 : next.kind === "success" ? 2600 : 4200);
    if (outcome.cap !== null && outcome.cap !== undefined && outcome.occupancy !== null && outcome.occupancy !== undefined) {
      const key = capFor(status.caps, outcome.zone, sessionId)?.zoneKey ?? "";
      // Shown until the next heartbeat brings a newer count.
      setScanOcc({ key, occupancy: outcome.occupancy, cap: outcome.cap, warnPct: outcome.warnPct || cap?.warnPct, beatAt: status.occupancyAt || 0 });
    }
  };

  const act = async (row, method, overrideReason = null) => {
    const key = rowKey(row);
    setBusyId(key);
    const opts = { method, gate, zone, sessionId, staff: role?.name || null, overrideReason };
    const outcome = mode === "exit" ? await engine.exit(row, opts) : await engine.admit(row, opts);
    setBusyId(null);
    show(outcome, row, method);
    const inside =
      outcome.kind === "success" || (outcome.kind === "already" && outcome.reason === "inside")
        ? true
        : outcome.kind === "exit" || outcome.kind === "notInside"
          ? false
          : null;
    if (inside !== null) {
      setResults((prev) => prev.map((r) => (rowKey(r) === key ? { ...r, checkedIn: inside } : r)));
    }
    if (outcome.kind === "success" || outcome.kind === "exit") refreshStats();
    return outcome;
  };

  const runSearch = async (text) => {
    const q = text.trim();
    if (!q) {
      setResults([]);
      setLastQuery("");
      setSearchNote("");
      return;
    }
    setSearching(true);
    const res = await engine.search(q, { sessionId, zone });
    setSearching(false);
    setResults(res.rows || []);
    setLastQuery(q);
    setSearchNote(
      res.unavailable
        ? "No connection, and this device has no offline guest list."
        : res.source === "local"
          ? "Searched this device's offline guest list."
          : "",
    );
  };

  const onScan = async (text) => {
    setPaused(true);
    try {
      const res = await engine.resolveScan(text, { sessionId, zone });
      setQuery(res.query || "");
      setResults(res.rows || []);
      setLastQuery(res.query || "");
      setSearchNote("");
      if (res.row) await act(res.row, "qr");
      else if (res.unavailable) show({ kind: "error", message: "No connection, and this device has no offline guest list" });
      else if (res.offline && (!res.rows?.length || res.byId)) {
        show({ kind: "error", message: "Not in this device's offline guest list — it may be newer than the last refresh" });
      } else if (!res.rows?.length || res.byId) show({ kind: "error", message: "No match for that code" });
    } finally {
      setTimeout(() => setPaused(false), 1200);
    }
  };

  const confirmOverride = async (reason) => {
    const target = overrideTarget;
    if (!target) return;
    await act(target.row, target.method, reason);
    setOverrideTarget(null);
  };

  const showNoMatches = !searching && !!lastQuery && results.length === 0;
  const exitMode = mode === "exit";

  return (
    <RouteShell
      title={event?.name || meta?.name || "Check-in"}
      subtitle={role?.name ? `Scanning as ${role.name}` : "Scanner"}
      count={stats}
      onExit={exit}
      banner={<OfflineBanner status={status} onSync={() => engine.syncNow({ manual: true })} />}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedTabs tabs={MODES} value={mode} onChange={setMode} />
          {occ ? <OccupancyChip label={cap?.zone || zone || "Venue"} occupancy={occ.occupancy} cap={occ.cap} warnPct={occ.warnPct} /> : null}
        </div>

        {gates.length || zones.length || sessions.length ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {gates.length ? (
              <Select value={gate || "__all"} onValueChange={(v) => setGate(v === "__all" ? "" : v)}>
                <SelectTrigger className="h-10 w-full bg-surface-card"><SelectValue placeholder="Gate" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Any gate</SelectItem>
                  {gates.map((g) => (
                    <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {zones.length ? (
              <Select value={zone || "__all"} onValueChange={(v) => setZone(v === "__all" ? "" : v)}>
                <SelectTrigger className="h-10 w-full bg-surface-card"><SelectValue placeholder="Zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Venue entrance</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {sessions.length ? (
              <Select value={sessionId || "__event"} onValueChange={(v) => setSessionId(v === "__event" ? "" : v)}>
                <SelectTrigger className="h-10 w-full bg-surface-card"><SelectValue placeholder="Session" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__event">Whole event</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        ) : null}

        <QrScanner onDecode={onScan} paused={paused} />

        <ScanFeedback
          feedback={feedback}
          onOverride={feedback?.override ? () => setOverrideTarget(feedback.override) : null}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="flex gap-2"
        >
          <IconInput
            icon={Search}
            wrapperClassName="flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, or ticket #"
            className="h-11 bg-surface-card"
          />
          <Button type="submit" disabled={searching} className="h-11 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        {searchNote ? <p className="text-xs text-text-tertiary">{searchNote}</p> : null}

        {showNoMatches ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-6 text-center text-sm text-text-secondary">
            No matches for &ldquo;{lastQuery}&rdquo;
          </div>
        ) : null}

        {results.length ? (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={rowKey(r)} className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {r.name || "Unnamed"}
                    {r.partySize > 1 ? <span className="font-normal text-text-secondary"> · party of {r.partySize}</span> : null}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {r.ticketName ? `${r.ticketName} · ` : ""}{r.email || "No email"} · <span className="font-mono">{r.ticketCode}</span>
                  </p>
                </div>
                {!r.admissible && !exitMode ? (
                  <span className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300">
                    {r.status}
                  </span>
                ) : exitMode ? (
                  r.checkedIn ? (
                    <Button
                      variant="outline"
                      className="h-10 shrink-0 border-border bg-transparent text-foreground hover:bg-surface-active"
                      disabled={busyId === rowKey(r)}
                      onClick={() => act(r, "manual")}
                    >
                      {busyId === rowKey(r) ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                      Exit
                    </Button>
                  ) : (
                    <span className="shrink-0 text-sm text-text-tertiary">Not in</span>
                  )
                ) : r.checkedIn ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> In
                  </span>
                ) : (
                  <Button
                    className="h-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={busyId === rowKey(r)}
                    onClick={() => act(r, "manual")}
                  >
                    {busyId === rowKey(r) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                    Admit
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <CapacityOverrideDialog
        target={overrideTarget}
        onOpenChange={(open) => !open && setOverrideTarget(null)}
        onConfirm={confirmOverride}
      />
    </RouteShell>
  );
}

export default function CheckinScannerPage() {
  const params = useParams();
  const eventId = Array.isArray(params?.eventId) ? params.eventId[0] : params?.eventId;
  const [event, setEvent] = useState(null);
  useCheckinServiceWorker("checkin");

  useEffect(() => {
    let alive = true;
    getEvent(eventId).then((row) => alive && setEvent(row));
    return () => {
      alive = false;
    };
  }, [eventId]);

  return (
    <AccessGate eventId={eventId} title="Check-in scanner" require="canScan" codeType="staff">
      {({ code, role, exit }) => (
        <Scanner eventId={eventId} code={code} role={role} exit={exit} event={event} />
      )}
    </AccessGate>
  );
}
