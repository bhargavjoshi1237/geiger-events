"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  Copy,
  ExternalLink,
  Loader2,
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
  newEventId,
} from "./sample_data";
import {
  listEvents,
  createEvent,
  updateEvent,
  softDeleteEvent,
} from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
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
      <DialogContent className="max-w-xl bg-background">
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
  // Seed from bundled sample data for an instant first paint, then replace with
  // the live table once it loads. `source` decides whether mutations persist.
  const [events, setEvents] = useState(EVENTS);
  const [source, setSource] = useState("sample");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // The open event lives in the URL (?event=<id>) so a refresh stays on it.
  const { eventId, openEvent, closeEvent } = useWorkspaceUrl();
  // Signed-in user — new events are stamped with created_by so only they can
  // upload that event's images (enforced by storage RLS).
  const [userId, setUserId] = useState(null);

  const usingDb = source === "db";

  // Resolve the open event from local state. Sample data resolves instantly;
  // a db-only id resolves once the live table loads. Unknown id ⇒ list view.
  const selectedEvent = useMemo(
    () => (eventId ? events.find((e) => e.id === eventId) || null : null),
    [eventId, events],
  );

  useEffect(() => {
    let alive = true;
    listEvents().then((rows) => {
      if (!alive) return;
      if (rows) {
        setEvents(rows);
        setSource("db");
      }
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, []);

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
      { label: "Avg. capacity", value: `${events.length ? Math.round(events.reduce((s, e) => s + (e.capacity ? e.sold / e.capacity : 0), 0) / events.length * 100) : 0}%`, footer: "Sell-through" },
    ];
  }, [events]);

  // Mutations update local state optimistically (instant UI) and, when backed
  // by the live table, persist through the data layer — surfacing a toast only
  // if the write fails. Local-only mode keeps working with no DB.
  const persistCreate = (event) => {
    if (!usingDb) return;
    createEvent(event).then((saved) => {
      if (!saved) {
        toast.error("Couldn't save the event to the server.");
      } else {
        setEvents((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      }
    });
  };

  const handleCreate = (draft) => {
    const name = draft.name.trim();
    const newEvent = {
      id: newEventId(),
      name,
      status: "Draft",
      type: draft.type,
      date: draft.date || "2026-07-15",
      time: draft.time || "18:00",
      venue: draft.venue || "TBD",
      address: "",
      city: "London",
      timezone: "Europe/London",
      capacity: draft.capacity,
      sold: 0,
      revenue: 0,
      visibility: draft.visibility,
      organizer: "Ava Mitchell",
      summary: "",
      coverUrl: "",
      gallery: [],
      createdBy: userId,
    };
    setEvents((prev) => [newEvent, ...prev]);
    toast.success(`"${newEvent.name}" created as a draft.`);
    persistCreate(newEvent);
  };

  const handleUpdate = (updated) => {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    if (usingDb) {
      updateEvent(updated.id, updated).then((saved) => {
        if (!saved) toast.error("Couldn't save your changes to the server.");
      });
    }
  };

  const handleDelete = (event) => {
    setDeleteTarget(null);
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    toast.success(`Deleted "${event.name}".`);
    if (usingDb) {
      softDeleteEvent(event.id).then((ok) => {
        if (!ok) toast.error("Couldn't delete the event on the server.");
      });
    }
  };

  const handleDuplicate = (event) => {
    const copy = {
      ...event,
      id: newEventId(),
      name: `${event.name} (copy)`,
      status: "Draft",
      sold: 0,
      revenue: 0,
      // The copy is owned by whoever duplicated it, and starts with no images
      // (they live under the original event's folder).
      createdBy: userId,
      coverUrl: "",
      gallery: [],
    };
    setEvents((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${event.name}".`);
    persistCreate(copy);
  };

  const handleViewPage = (event) => {
    if (typeof window !== "undefined") {
      window.open(`/e/${event.id}`, "_blank", "noopener,noreferrer");
    }
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
            className="w-44 border-border bg-surface-card shadow-xl"
          >
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
              onClick={() => openEvent(e.id)}
            >
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
              onClick={() => handleDuplicate(e)}
            >
              <Copy className="h-4 w-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
              onClick={() => handleViewPage(e)}
            >
              <ExternalLink className="h-4 w-4" /> View page
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-surface-strong" />
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
              onClick={() => setDeleteTarget(e)}
            >
              <Trash2 className="h-4 w-4 text-red-300" /> Delete
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
        onBack={closeEvent}
        onUpdate={handleUpdate}
        onDelete={(ev) => {
          handleDelete(ev);
          closeEvent();
        }}
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

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(e) => e.id}
          onRowClick={(e) => openEvent(e.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={CalendarPlus}
                title={
                  events.length
                    ? "No events match your filters"
                    : "No events yet"
                }
                description={
                  events.length
                    ? "Try clearing the search or filters, or create a new event to get started."
                    : "Create your first event to start selling tickets and collecting RSVPs."
                }
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
      )}

      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => handleDelete(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default AllEventsScreen;
