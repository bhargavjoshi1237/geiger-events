"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle, Search, UserCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEvent } from "@/lib/supabase/events";
import { searchCheckin, admitCheckin, checkinStats } from "@/lib/supabase/checkin";
import { AccessGate } from "@/components/checkin_routes/access_gate";
import { RouteShell } from "@/components/checkin_routes/route_shell";
import { QrScanner } from "@/components/checkin_routes/qr_scanner";

const FEEDBACK = {
  success: { icon: CheckCircle2, cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200" },
  already: { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/15 text-amber-200" },
  error: { icon: XCircle, cls: "border-red-500/30 bg-red-500/15 text-red-200" },
};

function Scanner({ eventId, code, role, exit, event }) {
  const [stats, setStats] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [gate, setGate] = useState("");
  const [zone, setZone] = useState("");
  const [feedback, setFeedback] = useState(null); // { kind, msg }
  const [paused, setPaused] = useState(false);
  const fbTimer = useRef(null);

  const sessions = event?.checkinSessions?.sessions || [];
  const gates = event?.checkinGates?.gates || [];
  const zones = event?.checkinGates?.zones || [];

  const refreshStats = useCallback(() => {
    checkinStats(eventId, code).then((s) => s && setStats(s));
  }, [eventId, code]);

  useEffect(() => {
    refreshStats();
    const t = setInterval(refreshStats, 15000);
    return () => clearInterval(t);
  }, [refreshStats]);

  const flash = (kind, msg) => {
    setFeedback({ kind, msg });
    if (fbTimer.current) clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setFeedback(null), 2600);
  };

  const admit = async (row, method) => {
    const res = await admitCheckin({
      eventId,
      code,
      registrationId: row.registrationId,
      name: row.name,
      ticketCode: row.ticketCode,
      gate: gate || null,
      zone: zone || null,
      sessionId: sessionId || null,
      method,
      staff: role?.name || null,
    });
    if (res?.ok) {
      flash("success", `Admitted ${row.name || "attendee"}`);
      setResults((prev) => prev.map((r) => (r.registrationId === row.registrationId ? { ...r, checkedIn: true } : r)));
      refreshStats();
    } else if (res?.already) {
      flash("already", `${row.name || "Attendee"} is already checked in`);
    } else {
      flash("error", "Couldn't record the check-in");
    }
  };

  const runSearch = async (text) => {
    const q = text.trim();
    if (!q) {
      setResults([]);
      return null;
    }
    setSearching(true);
    const rows = await searchCheckin(eventId, code, q);
    setSearching(false);
    setResults(rows || []);
    return rows || [];
  };

  const onScan = async (text) => {
    setPaused(true);
    setQuery(text);
    const rows = await runSearch(text);
    const exact =
      rows?.find((r) => r.ticketCode === text.trim().toUpperCase()) ||
      (rows?.length === 1 ? rows[0] : null);
    if (exact) {
      if (exact.checkedIn) flash("already", `${exact.name || "Attendee"} is already checked in`);
      else await admit(exact, "qr");
    } else if (!rows?.length) {
      flash("error", "No match for that code");
    }
    setTimeout(() => setPaused(false), 1200);
  };

  const fb = feedback ? FEEDBACK[feedback.kind] : null;

  return (
    <RouteShell
      title={event?.name || "Check-in"}
      subtitle={role?.name ? `Scanning as ${role.name}` : "Scanner"}
      count={stats}
      onExit={exit}
    >
      <div className="space-y-4">
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
                  <SelectItem value="__all">Any zone</SelectItem>
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

        {fb ? (
          <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${fb.cls}`}>
            <fb.icon className="h-5 w-5 shrink-0" />
            {feedback.msg}
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, or ticket #"
              className="h-11 bg-surface-card pl-9"
            />
          </div>
          <Button type="submit" disabled={searching} className="h-11 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        {results.length ? (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.registrationId} className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{r.name || "Unnamed"}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {r.email || "No email"} · <span className="font-mono">{r.ticketCode}</span>
                  </p>
                </div>
                {r.checkedIn ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> In
                  </span>
                ) : (
                  <Button className="h-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => admit(r, "manual")}>
                    <UserCheck className="h-4 w-4" /> Admit
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </RouteShell>
  );
}

export default function CheckinScannerPage() {
  const params = useParams();
  const eventId = Array.isArray(params?.eventId) ? params.eventId[0] : params?.eventId;
  const [event, setEvent] = useState(null);

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
