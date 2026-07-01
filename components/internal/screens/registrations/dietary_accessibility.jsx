"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Accessibility, Download, Loader2, Utensils } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatGrid,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { listEvents } from "@/lib/supabase/events";
import { listRegistrations } from "@/lib/supabase/registrations";
import { useProject } from "@/context/project-context";
import { DIETARY_TAGS, formatDateTime } from "./constants";
import { downloadCsv } from "./csv";

export function DietaryAccessibilityScreen() {
  const [regs, setRegs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([listRegistrations(projectId), listEvents(projectId)]).then(([rows, evts]) => {
      if (!alive) return;
      setRegs(rows ?? []);
      setEvents(evts ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const eventNames = useMemo(() => {
    const m = {};
    for (const e of events) m[e.id] = e.name;
    return m;
  }, [events]);

  const eventFilterOptions = useMemo(
    () => [
      { value: "all", label: "All events" },
      ...events.map((e) => ({ value: e.id, label: e.name })),
    ],
    [events],
  );

  const withNeeds = useMemo(
    () =>
      regs.filter(
        (r) =>
          !["Cancelled", "Declined"].includes(r.status) &&
          (r.dietary?.trim() || r.accessibility?.trim()),
      ),
    [regs],
  );

  // The report scope follows the event filter (the summary + list move together).
  const scoped = useMemo(
    () =>
      withNeeds.filter((r) =>
        eventFilter === "all" ? true : r.eventId === eventFilter,
      ),
    [withNeeds, eventFilter],
  );

  const filtered = useMemo(
    () =>
      scoped.filter((r) =>
        search
          ? `${r.name} ${r.dietary} ${r.accessibility}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      ),
    [scoped, search],
  );

  const dietaryBreakdown = useMemo(() => {
    const diet = scoped.filter((r) => r.dietary?.trim());
    return DIETARY_TAGS.map((tag) => ({
      tag,
      count: diet.filter((r) =>
        r.dietary.toLowerCase().includes(tag.toLowerCase()),
      ).length,
    })).filter((b) => b.count > 0);
  }, [scoped]);

  const stats = useMemo(() => {
    const dietary = scoped.filter((r) => r.dietary?.trim()).length;
    const access = scoped.filter((r) => r.accessibility?.trim()).length;
    const heads = scoped.reduce((s, r) => s + (Number(r.partySize) || 1), 0);
    return [
      { label: "Registrations with needs", value: String(scoped.length), hint: `${heads} total heads` },
      { label: "Dietary requirements", value: String(dietary), hint: "For catering" },
      { label: "Accessibility requests", value: String(access), hint: "For venue ops" },
    ];
  }, [scoped]);

  const handleExport = () => {
    if (!filtered.length) {
      toast.error("Nothing to export for these filters.");
      return;
    }
    downloadCsv(
      [
        { header: "Name", value: (r) => r.name },
        { header: "Email", value: (r) => r.email },
        { header: "Event", value: (r) => eventNames[r.eventId] || "" },
        { header: "Dietary", value: (r) => r.dietary },
        { header: "Accessibility", value: (r) => r.accessibility },
        { header: "Party", value: (r) => r.partySize },
      ],
      filtered,
      "dietary-accessibility.csv",
    );
    toast.success(`Exported ${filtered.length} rows.`);
  };

  const columns = [
    {
      key: "name",
      header: "Registrant",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{r.name}</span>
          <span className="text-xs text-text-secondary">
            {eventNames[r.eventId] || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "dietary",
      header: "Dietary",
      render: (r) =>
        r.dietary?.trim() ? (
          <Badge variant="warning">{r.dietary}</Badge>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      key: "accessibility",
      header: "Accessibility",
      render: (r) =>
        r.accessibility?.trim() ? (
          <span className="text-sm text-foreground">{r.accessibility}</span>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      key: "party",
      header: "Party",
      align: "right",
      className: "text-right tabular-nums",
      render: (r) => r.partySize,
    },
    {
      key: "registered",
      header: "Registered",
      render: (r) => (
        <span className="text-sm text-text-secondary">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Dietary & Accessibility"
        description="Every dietary and accessibility need across your registrations — a planning sheet for catering and venue ops."
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

      <div className="flex items-center justify-between gap-3">
        <FilterDropdown
          value={eventFilter}
          onValueChange={setEventFilter}
          options={eventFilterOptions}
          height="h-9"
        />
        <span className="text-sm text-text-tertiary">
          {eventFilter === "all"
            ? "All events"
            : eventNames[eventFilter] || "Event"}
        </span>
      </div>

      <StatGrid stats={stats} columns={3} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading needs…
        </div>
      ) : (
        <>
          {/* Catering headcount — the report's headline. */}
          <SectionCard
            title="Dietary breakdown"
            description="Headcount per requirement for the current scope — hand this to catering."
          >
            {dietaryBreakdown.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {dietaryBreakdown.map((b) => (
                  <div
                    key={b.tag}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-card px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-amber-400">
                      <Utensils className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none text-foreground tabular-nums">
                        {b.count}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">{b.tag}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-2 text-sm text-text-secondary">
                No dietary requirements recorded for this scope.
              </p>
            )}
          </SectionCard>

          {/* The underlying list. */}
          <Toolbar>
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Accessibility className="h-4 w-4 text-text-tertiary" />
              {filtered.length} {filtered.length === 1 ? "person" : "people"} with needs
            </span>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name or need…"
              className="w-full sm:max-w-xs"
            />
          </Toolbar>

          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(r) => r.id}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Accessibility}
                  title={
                    scoped.length
                      ? "No needs match your search"
                      : "No special needs recorded"
                  }
                  description={
                    scoped.length
                      ? "Try a different search."
                      : "When registrants share dietary or accessibility needs, they're collected here for planning."
                  }
                />
              </div>
            }
          />
        </>
      )}
    </MainScreenWrapper>
  );
}

export default DietaryAccessibilityScreen;
