"use client";

import React from "react";
import {
  CalendarDays,
  CalendarPlus,
  ArrowUpRight,
  Clock,
  Copy,
  FileText,
  LayoutTemplate,
  Repeat,
  Ticket,
  Users,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  ScreenHeader,
  SectionCard,
  StatGrid,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EVENTS,
  EVENT_STATUS_MAP,
  EVENT_TYPE_MAP,
  currency,
  formatDate,
} from "./sample_data";

const QUICK_ACTIONS = [
  { label: "New event", hint: "Start from scratch", icon: CalendarPlus },
  { label: "From template", hint: "Reuse a proven setup", icon: LayoutTemplate },
  { label: "Clone an event", hint: "Duplicate & reschedule", icon: Copy },
  { label: "Set up recurring", hint: "Weekly / monthly cadence", icon: Repeat },
];

export function EventsHomeScreen() {
  const upcoming = EVENTS.filter((e) => e.status !== "Ended").slice(0, 5);
  const drafts = EVENTS.filter((e) => e.status === "Draft");

  const stats = [
    { label: "Total events", value: String(EVENTS.length), icon: CalendarDays, hint: "In this workspace" },
    { label: "Upcoming", value: String(upcoming.length), icon: Clock, hint: "Not yet ended" },
    { label: "Tickets sold", value: EVENTS.reduce((s, e) => s + e.sold, 0).toLocaleString(), icon: Ticket, hint: "All time" },
    { label: "Drafts", value: String(drafts.length), icon: FileText, hint: "Awaiting publish" },
  ];

  const columns = [
    {
      key: "name",
      header: "Event",
      render: (e) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{e.name}</span>
          <span className="text-xs text-text-secondary">
            {formatDate(e.date)} · {e.venue}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Format",
      render: (e) => (
        <Badge variant={EVENT_TYPE_MAP[e.type]?.variant || "neutral"}>
          {e.type}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusPill status={e.status} map={EVENT_STATUS_MAP} />,
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      className: "text-right font-semibold tabular-nums text-white",
      render: (e) => currency(e.revenue),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Events"
        description="Your event command center — create, organize, and keep momentum across everything you're running."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <CalendarPlus className="h-4 w-4" /> Create event
          </Button>
        }
      />

      <StatGrid stats={stats} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:bg-surface-card"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {action.label}
                </p>
                <p className="truncate text-xs text-text-secondary">{action.hint}</p>
              </div>
              <ArrowUpRight className="ml-auto h-4 w-4 text-text-tertiary transition-colors group-hover:text-muted-foreground" />
            </button>
          );
        })}
      </div>

      <SectionCard
        title="Upcoming events"
        description="The next events on your calendar."
        action={
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            View all
          </Button>
        }
        bodyPadding={false}
      >
        <DataTable
          columns={columns}
          data={upcoming}
          getRowKey={(e) => e.id}
          className="rounded-none border-0"
        />
      </SectionCard>
    </MainScreenWrapper>
  );
}

export default EventsHomeScreen;
