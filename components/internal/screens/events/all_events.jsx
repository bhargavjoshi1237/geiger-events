"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import {
  EVENTS,
  EVENT_STATUS_MAP,
  EVENT_TYPE_MAP,
  VENUES,
  currency,
  formatDate,
} from "./sample_data";
import { EventDetailScreen } from "./event_detail";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "On sale", label: "On sale" },
  { value: "Sold out", label: "Sold out" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Draft", label: "Draft" },
  { value: "Ended", label: "Ended" },
];

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "In-person", label: "In-person" },
  { value: "Online", label: "Online" },
  { value: "Hybrid", label: "Hybrid" },
];

const EMPTY_DRAFT = {
  name: "",
  type: "In-person",
  date: "",
  time: "",
  venue: "",
  capacity: "",
  visibility: "Public",
};

function CreateEventDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give your event a name first.");
      return;
    }
    onCreate({
      ...draft,
      capacity: Number(draft.capacity) || 0,
    });
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>
            Set the essentials now — you can flesh out tickets, the page, and
            settings in the Event Builder.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Event name" htmlFor="evt-name">
            <Input
              id="evt-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Autumn Design Meetup"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Format">
              <Select value={draft.type} onValueChange={set("type")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="In-person">In-person</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Visibility">
              <Select value={draft.visibility} onValueChange={set("visibility")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Public">Public</SelectItem>
                  <SelectItem value="Unlisted">Unlisted</SelectItem>
                  <SelectItem value="Private">Private</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => set("date")(e.target.value)}
              />
            </Field>
            <Field label="Start time">
              <Input
                type="time"
                value={draft.time}
                onChange={(e) => set("time")(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Venue">
              <Select value={draft.venue} onValueChange={set("venue")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  {VENUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Capacity">
              <Input
                type="number"
                min={0}
                value={draft.capacity}
                onChange={(e) => set("capacity")(e.target.value)}
                placeholder="e.g. 120"
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Create event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AllEventsScreen() {
  const [events, setEvents] = useState(EVENTS);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (type !== "all" && e.type !== type) return false;
      if (
        search &&
        !`${e.name} ${e.venue} ${e.city}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [events, search, status, type]);

  const stats = useMemo(() => {
    const live = events.filter((e) =>
      ["On sale", "Sold out"].includes(e.status),
    ).length;
    const sold = events.reduce((s, e) => s + e.sold, 0);
    const revenue = events.reduce((s, e) => s + e.revenue, 0);
    return [
      { label: "Total events", value: String(events.length), footer: `${live} on sale now` },
      { label: "Tickets sold", value: sold.toLocaleString(), footer: "Across all events" },
      { label: "Revenue", value: currency(revenue), footer: "Gross, before fees" },
      { label: "Avg. capacity", value: `${Math.round(events.reduce((s, e) => s + (e.capacity ? e.sold / e.capacity : 0), 0) / events.length * 100)}%`, footer: "Sell-through" },
    ];
  }, [events]);

  const handleCreate = (draft) => {
    const newEvent = {
      id: `evt_${Date.now()}`,
      name: draft.name.trim(),
      status: "Draft",
      type: draft.type,
      date: draft.date || "2026-07-15",
      time: draft.time || "18:00",
      venue: draft.venue || "TBD",
      city: "London",
      capacity: draft.capacity,
      sold: 0,
      revenue: 0,
      visibility: draft.visibility,
      organizer: "Ava Mitchell",
    };
    setEvents((prev) => [newEvent, ...prev]);
    toast.success(`"${newEvent.name}" created as a draft.`);
  };

  const handleDelete = (event) => {
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    toast.success(`Deleted "${event.name}".`);
  };

  const handleDuplicate = (event) => {
    setEvents((prev) => [
      {
        ...event,
        id: `evt_${Date.now()}`,
        name: `${event.name} (copy)`,
        status: "Draft",
        sold: 0,
        revenue: 0,
      },
      ...prev,
    ]);
    toast.success(`Duplicated "${event.name}".`);
  };

  const columns = [
    {
      key: "name",
      header: "Event",
      render: (e) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{e.name}</span>
          <span className="text-xs text-text-secondary">
            {formatDate(e.date)} · {e.time} · {e.venue}
            {e.city && e.city !== "Remote" ? `, ${e.city}` : ""}
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
      key: "type",
      header: "Format",
      render: (e) => (
        <Badge variant={EVENT_TYPE_MAP[e.type]?.variant || "neutral"}>
          {e.type}
        </Badge>
      ),
    },
    {
      key: "sellthrough",
      header: "Sell-through",
      render: (e) => {
        const pct = e.capacity
          ? Math.min(100, Math.round((e.sold / e.capacity) * 100))
          : 0;
        return (
          <div className="w-[150px] space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full bg-[#ededed]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-text-secondary">
              {e.sold.toLocaleString()} / {e.capacity.toLocaleString()} · {pct}%
            </p>
          </div>
        );
      },
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      className: "text-right font-semibold tabular-nums text-white",
      render: (e) => currency(e.revenue),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (e) => (
        <div onClick={(ev) => ev.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="border-border bg-surface-subtle text-foreground"
          >
            <DropdownMenuItem
              className="focus:bg-surface-hover"
              onClick={() => setSelectedEvent(e)}
            >
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="focus:bg-surface-hover"
              onClick={() => handleDuplicate(e)}
            >
              <Copy className="h-4 w-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="focus:bg-surface-hover">
              <ExternalLink className="h-4 w-4" /> View page
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-surface-hover" />
            <DropdownMenuItem
              variant="destructive"
              className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
              onClick={() => handleDelete(e)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      ),
    },
  ];

  if (selectedEvent) {
    return (
      <EventDetailScreen
        event={selectedEvent}
        onBack={() => setSelectedEvent(null)}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="All Events"
        description="Every event in your workspace — drafts, on sale, and past. Search, filter, and manage them all from here."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create event
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={type}
            onValueChange={setType}
            options={TYPE_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search events, venues, cities…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(e) => e.id}
        onRowClick={(e) => setSelectedEvent(e)}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={CalendarPlus}
              title="No events match your filters"
              description="Try clearing the search or filters, or create a new event to get started."
              action={
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Create event
                </Button>
              }
            />
          </div>
        }
      />

      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />
    </MainScreenWrapper>
  );
}

export default AllEventsScreen;
