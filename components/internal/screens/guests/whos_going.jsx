"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Download, Loader2 } from "lucide-react";

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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import { listAttendeeRows } from "@/lib/supabase/attendees";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import {
  GUEST_STATUS_MAP,
  UPCOMING_WINDOW_OPTIONS,
  addDaysISO,
  formatDate,
  initials,
  todayISO,
} from "./constants";

const GOING = new Set(["Confirmed", "Checked-in"]);

export function WhosGoingScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [windowFilter, setWindowFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    listAttendeeRows(projectId).then((r) => {
      if (!alive) return;
      setRows(r ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Everyone holding a ticket/registration for an event still to come.
  const upcoming = useMemo(() => {
    const today = todayISO();
    return rows.filter(
      (r) =>
        r.eventDate &&
        r.eventDate >= today &&
        r.eventStatus !== "Cancelled",
    );
  }, [rows]);

  const eventFilterOptions = useMemo(() => {
    const seen = new Map();
    for (const r of upcoming) {
      if (r.eventId && !seen.has(r.eventId)) seen.set(r.eventId, r.eventName);
    }
    return [
      { value: "all", label: "All events" },
      ...Array.from(seen, ([value, label]) => ({ value, label: label || "Event" })),
    ];
  }, [upcoming]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = todayISO();
    const end =
      windowFilter === "today"
        ? today
        : windowFilter === "week"
          ? addDaysISO(6)
          : windowFilter === "month"
            ? addDaysISO(29)
            : null;
    return upcoming.filter((r) => {
      if (end && r.eventDate > end) return false;
      if (eventFilter !== "all" && r.eventId !== eventFilter) return false;
      if (q) {
        const hay = `${r.name} ${r.email} ${r.eventName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [upcoming, search, windowFilter, eventFilter]);

  const stats = useMemo(() => {
    const events = new Set(filtered.map((r) => r.eventId));
    const people = new Set(filtered.map((r) => r.email.toLowerCase()));
    const going = filtered.filter((r) => GOING.has(r.status)).length;
    return [
      { label: "Upcoming events", value: events.size.toLocaleString() },
      { label: "Attendees", value: people.size.toLocaleString() },
      { label: "Tickets", value: filtered.length.toLocaleString() },
      { label: "Going", value: going.toLocaleString() },
    ];
  }, [filtered]);

  const filtersActive =
    windowFilter !== "all" || eventFilter !== "all" || Boolean(search.trim());

  const handleExport = () => {
    if (!filtered.length) {
      toast.error("No attendees to export.");
      return;
    }
    downloadCsv(
      [
        { header: "Name", value: (r) => r.name },
        { header: "Email", value: (r) => r.email },
        { header: "Phone", value: (r) => r.phone },
        { header: "Event", value: (r) => r.eventName },
        { header: "Date", value: (r) => r.eventDate },
        { header: "Venue", value: (r) => r.eventVenue },
        { header: "Status", value: (r) => r.status },
      ],
      filtered,
      "whos-going.csv",
    );
    toast.success(`Exported ${filtered.length} attendees.`);
  };

  const columns = [
    {
      key: "guest",
      header: "Guest",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
            {initials(r.name, r.email) || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {r.name || "Unnamed"}
            </p>
            <p className="truncate text-xs text-text-secondary">
              {r.email || "No email"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (r) => (
        <span className="text-sm text-foreground">{r.eventName || "—"}</span>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (r) => (
        <span className="text-sm text-text-secondary">
          {formatDate(r.eventDate)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      render: (r) =>
        r.status ? <StatusPill status={r.status} map={GUEST_STATUS_MAP} /> : "—",
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Who's Going"
        description="Everyone holding a ticket or registration for an event still to come. Narrow to today or the next few weeks, then export the roster."
        actions={
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={handleExport}
          >
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={windowFilter}
            onValueChange={setWindowFilter}
            options={UPCOMING_WINDOW_OPTIONS}
          />
          <FilterDropdown
            value={eventFilter}
            onValueChange={setEventFilter}
            options={eventFilterOptions}
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email or event…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading attendees…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={CalendarCheck}
              title={
                filtersActive
                  ? "No attendees match your filters"
                  : "No upcoming attendees yet"
              }
              description={
                filtersActive
                  ? "Try a wider window or a different event."
                  : "As people register or buy tickets for events that haven't happened yet, they appear here."
              }
              action={
                filtersActive ? (
                  <Button
                    variant="outline"
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => {
                      setWindowFilter("all");
                      setEventFilter("all");
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          }
        />
      )}
    </MainScreenWrapper>
  );
}

export default WhosGoingScreen;
