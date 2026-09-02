"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Loader2, RefreshCw, MapPin, Clock } from "lucide-react";

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
import { Button } from "@geiger/ui/button";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { useOptionalProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listRegistrations } from "@/lib/supabase/registrations";
import { listAttendanceByProject } from "@/lib/supabase/checkin";
import { DEMO_ATTENDANCE } from "./demo_attendance";
import { ATTENDANCE_STATUS_FILTER_OPTIONS, ATTENDANCE_STATUS_MAP, formatDate } from "./constants";

const REFRESH_MS = 15000;

export function RealTimeAttendanceScreen({ demo = false }) {
  const projectId = useOptionalProject()?.projectId ?? null;
  const [events, setEvents] = useState(demo ? DEMO_ATTENDANCE.events : []);
  const [regs, setRegs] = useState(demo ? DEMO_ATTENDANCE.regs : []);
  const [attendance, setAttendance] = useState(demo ? DEMO_ATTENDANCE.attendance : []);
  const [loading, setLoading] = useState(!demo);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const refreshAttendance = async () => {
    if (demo) return;
    setRefreshing(true);
    const rows = await listAttendanceByProject(projectId);
    setAttendance(rows ?? []);
    setRefreshing(false);
  };

  useEffect(() => {
    if (demo) return;
    let alive = true;
    Promise.all([
      listEvents(projectId),
      listRegistrations(projectId),
      listAttendanceByProject(projectId),
    ]).then(([evts, rg, att]) => {
      if (!alive) return;
      setEvents(evts ?? []);
      setRegs(rg ?? []);
      setAttendance(att ?? []);
      setLoading(false);
    });
    timer.current = setInterval(() => {
      listAttendanceByProject(projectId).then((rows) => {
        if (alive && rows) setAttendance(rows);
      });
    }, REFRESH_MS);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [projectId, demo]);

  const byEvent = useMemo(() => {
    const inByEvent = {};
    const rowsByEvent = {};
    for (const a of attendance) {
      if (a.status !== "in") continue;
      (inByEvent[a.eventId] ||= new Set()).add(
        a.registrationId || a.orderId || a.id,
      );
      (rowsByEvent[a.eventId] ||= []).push(a);
    }
    const confByEvent = {};
    for (const r of regs) {
      if (["Confirmed", "Checked-in"].includes(r.status)) {
        confByEvent[r.eventId] = (confByEvent[r.eventId] || 0) + 1;
      }
    }
    return { inByEvent, confByEvent, rowsByEvent };
  }, [attendance, regs]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      .map((e) => {
        const checkedIn = byEvent.inByEvent[e.id]?.size || 0;
        const expected = byEvent.confByEvent[e.id] || e.sold || 0;
        const pct = expected ? Math.round((checkedIn / expected) * 100) : 0;
        const evRows = byEvent.rowsByEvent[e.id] || [];
        const sessName = new Map((e.checkinSessions?.sessions || []).map((s) => [s.id, s.name]));
        const gateB = {};
        const sessB = {};
        for (const a of evRows) {
          if (a.gate) gateB[a.gate] = (gateB[a.gate] || 0) + 1;
          if (a.sessionId) {
            const n = sessName.get(a.sessionId) || "Session";
            sessB[n] = (sessB[n] || 0) + 1;
          }
        }
        const toChips = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
        return { ...e, checkedIn, expected, pct, gates: toChips(gateB), sessions: toChips(sessB) };
      })
      .filter((r) => {
        if (status === "live") return r.checkedIn > 0;
        if (status === "idle") return r.checkedIn === 0;
        return true;
      })
      .sort((a, b) => b.checkedIn - a.checkedIn);
  }, [events, byEvent, search, status]);

  // Every active filter joins the reset key, so changing one drops back to page 1.
  const pager = usePagination(rows, { resetKey: `${search}|${status}` });

  const stats = useMemo(() => {
    const totalIn = rows.reduce((s, r) => s + r.checkedIn, 0);
    const totalExp = rows.reduce((s, r) => s + r.expected, 0);
    const live = rows.filter((r) => r.checkedIn > 0).length;
    return [
      { label: "Checked in now", value: totalIn.toLocaleString("en-US"), footer: "Across all events" },
      { label: "Live events", value: String(live), footer: "With attendees on site" },
      {
        label: "Overall arrival",
        value: totalExp ? `${Math.round((totalIn / totalExp) * 100)}%` : "0%",
        footer: "Checked in vs expected",
      },
    ];
  }, [rows]);

  const columns = [
    {
      key: "event",
      header: "Event",
      className: "w-full",
      headClassName: "w-full",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{formatDate(r.date)}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (r) => (
        <StatusPill status={r.checkedIn > 0 ? "live" : "idle"} map={ATTENDANCE_STATUS_MAP} />
      ),
    },
    {
      key: "checkedIn",
      header: "Checked in",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums",
      headClassName: "whitespace-nowrap",
      render: (r) => (
        <span>
          <span className="font-semibold text-foreground">{r.checkedIn.toLocaleString("en-US")}</span>
          <span className="text-text-tertiary"> / {r.expected.toLocaleString("en-US")}</span>
        </span>
      ),
    },
    {
      key: "arrival",
      header: "Arrival",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${Math.min(100, r.pct)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-text-secondary">{r.pct}%</span>
        </div>
      ),
    },
    {
      key: "breakdown",
      header: "Gates & sessions",
      render: (r) =>
        r.gates.length || r.sessions.length ? (
          <div className="flex flex-wrap gap-1.5">
            {r.gates.map(([name, n]) => (
              <span
                key={`g-${name}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-card px-2 py-0.5 text-[11px] text-text-secondary"
              >
                <MapPin className="h-3 w-3 text-text-tertiary" />
                {name} <span className="font-medium text-foreground tabular-nums">{n}</span>
              </span>
            ))}
            {r.sessions.map(([name, n]) => (
              <span
                key={`s-${name}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-card px-2 py-0.5 text-[11px] text-text-secondary"
              >
                <Clock className="h-3 w-3 text-text-tertiary" />
                {name} <span className="font-medium text-foreground tabular-nums">{n}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Real-time Attendance"
        description="Live check-in counts across every event, refreshed automatically. Watch arrivals build as your doors open."
        actions={
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            disabled={refreshing}
            onClick={refreshAttendance}
          >
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        }
      />

      <StatsBar stats={stats} columns={3} />

      <Toolbar>
        <FilterDropdown
          value={status}
          onValueChange={setStatus}
          options={ATTENDANCE_STATUS_FILTER_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search events…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance…
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(r) => r.id}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Activity}
                  title={events.length ? "No events match your filters" : "No events yet"}
                  description={
                    events.length
                      ? "Try clearing the search or status filter."
                      : "Once you create events and staff start scanning, live counts appear here."
                  }
                  action={
                    events.length ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearch("");
                          setStatus("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : null
                  }
                />
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="events" />
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default RealTimeAttendanceScreen;
