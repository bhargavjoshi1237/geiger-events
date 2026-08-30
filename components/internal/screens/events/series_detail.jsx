"use client";

import React, { useMemo, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  SlidersHorizontal,
  Repeat,
  Send,
  Plus,
  ArrowUp,
  ArrowDown,
  X,
  ExternalLink,
  CalendarPlus,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  SectionCard,
  StatGrid,
  DataTable,
  StatusPill,
  EmptyState,
  SettingsList,
  SettingRow,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import {
  EVENT_STATUS_MAP,
  SERIES_CADENCE_OPTIONS,
  SERIES_STATUS_OPTIONS,
  SERIES_VISIBILITY_OPTIONS,
  currency,
  formatDate,
} from "./sample_data";
import { EventDatePicker } from "./date_time_fields";

const FORMAT_OPTIONS = [
  { value: "In-person", label: "In-person" },
  { value: "Online", label: "Online" },
  { value: "Hybrid", label: "Hybrid" },
];

const TABS = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    desc: "How the series is performing across every event in the run.",
  },
  {
    key: "events",
    label: "Events",
    icon: CalendarDays,
    desc: "The events in this series and the order they run in.",
  },
  {
    key: "defaults",
    label: "Shared Defaults",
    icon: SlidersHorizontal,
    desc: "Settings every event in the series inherits.",
  },
  {
    key: "cadence",
    label: "Cadence",
    icon: Repeat,
    desc: "How often the series repeats and when the next event lands.",
  },
  {
    key: "publishing",
    label: "Publishing",
    icon: Send,
    desc: "How the series appears publicly and when events go live.",
  },
];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

function upcomingDates(anchor, cadence, count = 5) {
  if (!anchor) return [];
  const start = new Date(`${anchor}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    if (cadence === "Weekly") d.setDate(start.getDate() + i * 7);
    else if (cadence === "Quarterly") d.setMonth(start.getMonth() + i * 3);
    else d.setMonth(start.getMonth() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function SeriesDetailScreen({
  series,
  events,
  onBack,
  onPatchSeries,
  onMergeSettings,
  onSetEventSeries,
  onPatchEvent,
  onCreateEventInSeries,
  onOpenEvent,
}) {
  const [addOpen, setAddOpen] = useState(false);

  const members = useMemo(() => {
    const inSeries = events.filter((e) => e.seriesId === series.id);
    const order = series.settings?.eventOrder || [];
    const rank = (id) => {
      const i = order.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...inSeries].sort((a, b) => {
      const d = rank(a.id) - rank(b.id);
      if (d !== 0) return d;
      return (a.date || "").localeCompare(b.date || "");
    });
  }, [events, series]);

  const available = useMemo(
    () => events.filter((e) => !e.seriesId),
    [events],
  );

  const move = (index, dir) => {
    const next = [...members];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onMergeSettings({ eventOrder: next.map((e) => e.id) });
  };

  return (
    <EditorShell
      back={{ label: "Event Series", onClick: onBack }}
      title={series.name}
      status={series.status}
      statusMap={EVENT_STATUS_MAP}
      meta={`${series.cadence} · ${members.length} event${members.length === 1 ? "" : "s"}`}
      nav={TABS}
      defaultSection="overview"
      after={
        <AddEventsDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          available={available}
          onAttach={(id) => onSetEventSeries(id, series.id)}
        />
      }
    >
      {({ active }) => (
        <>
          {active === "overview" && (
            <OverviewTab
              series={series}
              members={members}
              onPatchSeries={onPatchSeries}
            />
          )}
          {active === "events" && (
            <EventsTab
              series={series}
              members={members}
              available={available}
              onAdd={() => setAddOpen(true)}
              onRemove={(id) => onSetEventSeries(id, null)}
              onCreate={() => onCreateEventInSeries(series.id)}
              onOpen={onOpenEvent}
              onMove={move}
            />
          )}
          {active === "defaults" && (
            <DefaultsTab
              series={series}
              members={members}
              onMergeSettings={onMergeSettings}
              onPatchEvent={onPatchEvent}
            />
          )}
          {active === "cadence" && (
            <CadenceTab
              series={series}
              onPatchSeries={onPatchSeries}
              onMergeSettings={onMergeSettings}
            />
          )}
          {active === "publishing" && (
            <PublishingTab
              series={series}
              onPatchSeries={onPatchSeries}
              onMergeSettings={onMergeSettings}
            />
          )}
        </>
      )}
    </EditorShell>
  );
}

function OverviewTab({ series, members, onPatchSeries }) {
  const [name, setName] = useState(series.name);
  const [description, setDescription] = useState(series.description);

  const stats = useMemo(() => {
    const capacity = members.reduce((s, e) => s + (e.capacity || 0), 0);
    const sold = members.reduce((s, e) => s + (e.sold || 0), 0);
    const revenue = members.reduce((s, e) => s + (e.revenue || 0), 0);
    const upcoming = members
      .map((e) => e.date)
      .filter(Boolean)
      .sort()
      .find((d) => d >= todayISO());
    return [
      { label: "Events", value: String(members.length) },
      { label: "Capacity", value: capacity.toLocaleString("en-US") },
      { label: "Tickets sold", value: sold.toLocaleString("en-US") },
      { label: "Revenue", value: currency(revenue) },
      { label: "Next event", value: upcoming ? formatDate(upcoming) : "—" },
    ];
  }, [members]);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} columns={5} />
      <SectionCard
        title="Series details"
        description="Name and describe this series. It's how attendees recognise the run."
      >
        <div className="grid gap-4">
          <Field label="Series name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== series.name && onPatchSeries({ name })}
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== series.description &&
                onPatchSeries({ description })
              }
              placeholder="What ties these events together?"
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

function EventsTab({
  series,
  members,
  available,
  onAdd,
  onRemove,
  onCreate,
  onOpen,
  onMove,
}) {
  const columns = [
    {
      key: "order",
      header: "",
      className: "w-10",
      render: (e) => {
        const i = members.findIndex((m) => m.id === e.id);
        return (
          <div
            className="flex flex-col"
            onClick={(ev) => ev.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Move up"
              disabled={i === 0}
              onClick={() => onMove(i, -1)}
              className="text-text-tertiary transition-colors hover:text-foreground disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={i === members.length - 1}
              onClick={() => onMove(i, 1)}
              className="text-text-tertiary transition-colors hover:text-foreground disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      },
    },
    {
      key: "name",
      header: "Event",
      render: (e) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{e.name}</span>
          <span className="text-xs text-text-secondary">
            {formatDate(e.date)} · {e.time} · {e.venue}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusPill status={e.status} map={EVENT_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (e) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(ev) => ev.stopPropagation()}
        >
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Open event"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpen(e.id)}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove from series"
            className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
            onClick={() => onRemove(e.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <SectionCard
      title="Events in this series"
      description="Add existing events or spin up a new one. Reorder with the arrows — that's the order attendees follow."
      action={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={onAdd}
            disabled={available.length === 0}
          >
            <Plus className="h-4 w-4" /> Add existing
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onCreate}
          >
            <CalendarPlus className="h-4 w-4" /> New event
          </Button>
        </div>
      }
      bodyPadding={false}
    >
      <DataTable
        columns={columns}
        data={members}
        getRowKey={(e) => e.id}
        onRowClick={(e) => onOpen(e.id)}
        empty={
          <EmptyState
            icon={CalendarDays}
            title="No events in this series yet"
            description="Add an existing event or create a new one to start building the run."
            action={
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={onCreate}
              >
                <CalendarPlus className="h-4 w-4" /> New event
              </Button>
            }
          />
        }
      />
    </SectionCard>
  );
}

function AddEventsDialog({ open, onOpenChange, available, onAttach }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>Add events to series</DialogTitle>
          <DialogDescription>
            Pick standalone events to pull into this series.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {available.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-text-secondary">
              Every event already belongs to a series.
            </p>
          ) : (
            available.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-subtle px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {e.name}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {formatDate(e.date)} · {e.venue}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => onAttach(e.id)}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DefaultsTab({ series, members, onMergeSettings, onPatchEvent }) {
  const d = series.settings?.defaults || {};
  const [draft, setDraft] = useState({
    type: d.type || "In-person",
    visibility: d.visibility || "Public",
    timezone: d.timezone || "Europe/London",
    organizer: d.organizer || "",
    capacity: d.capacity ? String(d.capacity) : "",
  });

  const set = (k) => (value) => setDraft((s) => ({ ...s, [k]: value }));

  const toDefaults = () => ({
    type: draft.type,
    visibility: draft.visibility,
    timezone: draft.timezone,
    organizer: draft.organizer,
    capacity: Number(draft.capacity) || 0,
  });

  const save = () => onMergeSettings({ defaults: toDefaults() });

  const applyToAll = () => {
    const defaults = toDefaults();
    onMergeSettings({ defaults });
    const patch = {
      type: defaults.type,
      visibility: defaults.visibility,
      timezone: defaults.timezone,
    };
    if (defaults.organizer) patch.organizer = defaults.organizer;
    if (defaults.capacity) patch.capacity = defaults.capacity;
    members.forEach((e) => onPatchEvent(e.id, patch));
  };

  return (
    <SectionCard
      title="Shared defaults"
      description="New events created in this series inherit these. Optionally push them onto every existing event too."
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Format">
            <Select value={draft.type} onValueChange={set("type")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Visibility">
            <Select value={draft.visibility} onValueChange={set("visibility")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERIES_VISIBILITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Organizer">
            <Input
              value={draft.organizer}
              onChange={(e) => set("organizer")(e.target.value)}
              placeholder="e.g. Ava Mitchell"
            />
          </Field>
          <Field label="Default capacity">
            <Input
              type="number"
              min={0}
              value={draft.capacity}
              onChange={(e) => set("capacity")(e.target.value)}
              placeholder="e.g. 120"
            />
          </Field>
        </div>
        <Field label="Time zone">
          <Input
            value={draft.timezone}
            onChange={(e) => set("timezone")(e.target.value)}
            placeholder="Europe/London"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={applyToAll}
            disabled={members.length === 0}
          >
            Apply to all {members.length} events
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={save}
          >
            Save defaults
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function CadenceTab({ series, onPatchSeries, onMergeSettings }) {
  const r = series.settings?.recurrence || {};
  const [cadence, setCadence] = useState(series.cadence);
  const [anchor, setAnchor] = useState(r.anchorDate || "");
  const [count, setCount] = useState(r.count ? String(r.count) : "6");

  const preview = useMemo(
    () => upcomingDates(anchor, cadence, Math.min(Number(count) || 0, 12)),
    [anchor, cadence, count],
  );

  const save = () => {
    if (cadence !== series.cadence) onPatchSeries({ cadence });
    onMergeSettings({
      recurrence: { anchorDate: anchor || null, count: Number(count) || 0 },
    });
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Cadence"
        description="How often events in this series recur. The anchor date seeds the preview below."
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Repeats">
              <Select value={cadence} onValueChange={setCadence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERIES_CADENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Anchor date">
              <EventDatePicker
                value={anchor}
                onChange={setAnchor}
              />
            </Field>
            <Field label="Occurrences">
              <Input
                type="number"
                min={1}
                max={12}
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={save}
            >
              Save cadence
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Upcoming dates"
        description="A preview of when the next events would land at this cadence."
        bodyPadding={false}
      >
        {preview.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Set an anchor date"
            description="Choose an anchor date to preview the recurrence schedule."
          />
        ) : (
          <ul className="divide-y divide-border">
            {preview.map((d, i) => (
              <li
                key={d}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="text-foreground">{formatDate(d)}</span>
                <Badge variant="neutral">#{i + 1}</Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function PublishingTab({ series, onPatchSeries, onMergeSettings }) {
  return (
    <SectionCard
      title="Publishing"
      description="Status, visibility, and the public follow page for this series."
    >
      <SettingsList>
        <SettingRow
          title="Status"
          description="Where this series is in its lifecycle."
          control={
            <Select
              value={series.status}
              onValueChange={(v) => onPatchSeries({ status: v })}
            >
              <SelectTrigger className="h-9 w-40 bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERIES_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <SettingRow
          title="Visibility"
          description="Who can find and follow this series."
          control={
            <Select
              value={series.visibility}
              onValueChange={(v) => onPatchSeries({ visibility: v })}
            >
              <SelectTrigger className="h-9 w-40 bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERIES_VISIBILITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <SettingRow
          title="Public follow page"
          description="Let attendees follow the whole series and get notified of new events."
          checked={Boolean(series.settings?.followPage)}
          onCheckedChange={(v) => onMergeSettings({ followPage: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

export default SeriesDetailScreen;
