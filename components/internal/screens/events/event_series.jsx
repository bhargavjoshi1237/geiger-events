"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Layers,
  Loader2,
  MoreHorizontal,
  Settings2,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  EVENT_SERIES,
  EVENT_STATUS_MAP,
  SERIES_CADENCE_OPTIONS,
  SERIES_STATUS_FILTER_OPTIONS,
  SERIES_VISIBILITY_OPTIONS,
  emptySeriesSettings,
  formatDate,
  newId,
} from "./sample_data";
import {
  listSeries,
  createSeries,
  updateSeries,
  mergeSeriesSettings,
  softDeleteSeries,
  setEventSeries,
} from "@/lib/supabase/series";
import {
  listEvents,
  createEvent,
  updateEvent,
} from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { SeriesDetailScreen } from "./series_detail";

const TODAY = "2026-06-27";

const EMPTY_DRAFT = {
  name: "",
  cadence: "Monthly",
  visibility: "Public",
  description: "",
};

function CreateSeriesDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const set = (k) => (value) => setDraft((d) => ({ ...d, [k]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give your series a name first.");
      return;
    }
    onCreate({ ...draft, name: draft.name.trim() });
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>New event series</DialogTitle>
          <DialogDescription>
            Bundle recurring or themed events so attendees can follow them
            together.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Series name" htmlFor="series-name">
            <Input
              id="series-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. First Friday Meetup"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cadence">
              <Select value={draft.cadence} onValueChange={set("cadence")}>
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
          <Field label="Description">
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What ties these events together?"
            />
          </Field>
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
            Create series
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EventSeriesScreen() {
  const [seriesList, setSeriesList] = useState(EVENT_SERIES);
  const [events, setEvents] = useState(EVENTS);
  const [source, setSource] = useState("sample");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [userId, setUserId] = useState(null);
  const { openEventInTab } = useWorkspaceUrl();

  const usingDb = source === "db";

  useEffect(() => {
    let alive = true;
    Promise.all([listSeries(), listEvents()]).then(([rows, evts]) => {
      if (!alive) return;
      if (rows) {
        setSeriesList(rows);
        setSource("db");
      }
      if (evts) setEvents(evts);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, []);

  // Group events by series once — powers per-series counts and next dates.
  const eventsBySeries = useMemo(() => {
    const map = {};
    for (const e of events) {
      if (!e.seriesId) continue;
      (map[e.seriesId] ||= []).push(e);
    }
    return map;
  }, [events]);

  const nextDateFor = (id) => {
    const dates = (eventsBySeries[id] || [])
      .map((e) => e.date)
      .filter((d) => d && d >= TODAY)
      .sort();
    return dates[0] || null;
  };

  const filtered = useMemo(() => {
    return seriesList.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [seriesList, search, status]);

  const stats = useMemo(() => {
    const grouped = Object.values(eventsBySeries).reduce(
      (s, arr) => s + arr.length,
      0,
    );
    const live = seriesList.filter((s) =>
      ["On sale", "Scheduled"].includes(s.status),
    ).length;
    return [
      { label: "Series", value: String(seriesList.length), footer: `${live} active` },
      { label: "Grouped events", value: String(grouped), footer: "Across all series" },
      {
        label: "Avg. per series",
        value: seriesList.length
          ? String(Math.round((grouped / seriesList.length) * 10) / 10)
          : "0",
        footer: "Events each",
      },
    ];
  }, [seriesList, eventsBySeries]);

  // --- Series mutations ---
  const handleCreate = (draft) => {
    const series = {
      id: newId(),
      name: draft.name,
      description: draft.description || "",
      status: "Draft",
      cadence: draft.cadence,
      visibility: draft.visibility,
      settings: emptySeriesSettings(),
      createdBy: userId,
    };
    setSeriesList((prev) => [series, ...prev]);
    toast.success(`Series "${series.name}" created.`);
    if (usingDb) {
      createSeries(series).then((saved) => {
        if (!saved) toast.error("Couldn't save the series to the server.");
        else
          setSeriesList((prev) =>
            prev.map((s) => (s.id === saved.id ? saved : s)),
          );
      });
    }
  };

  const handlePatchSeries = (id, patch) => {
    setSeriesList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    if (usingDb) {
      updateSeries(id, patch).then((saved) => {
        if (!saved) toast.error("Couldn't save your changes to the server.");
      });
    }
  };

  // Shallow-merge a settings patch (one top-level key per editor tab), mirroring
  // the flow_series_merge_settings RPC so local and DB modes behave the same.
  const handleMergeSettings = (id, patch) => {
    setSeriesList((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, settings: { ...s.settings, ...patch } } : s,
      ),
    );
    if (usingDb) {
      mergeSeriesSettings(id, patch).then((ok) => {
        if (ok === false) toast.error("Couldn't save settings to the server.");
      });
    }
  };

  const handleDelete = (series) => {
    // Detach members locally so they return to the standalone pool.
    setEvents((prev) =>
      prev.map((e) =>
        e.seriesId === series.id ? { ...e, seriesId: null } : e,
      ),
    );
    setSeriesList((prev) => prev.filter((s) => s.id !== series.id));
    if (selectedId === series.id) setSelectedId(null);
    toast.success(`Deleted "${series.name}".`);
    if (usingDb) {
      (eventsBySeries[series.id] || []).forEach((e) =>
        setEventSeries(e.id, null),
      );
      softDeleteSeries(series.id).then((ok) => {
        if (!ok) toast.error("Couldn't delete the series on the server.");
      });
    }
  };

  // --- Membership / event mutations (lifted from the detail editor) ---
  const handleSetEventSeries = (eventId, seriesId) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, seriesId } : e)),
    );
    const evt = events.find((e) => e.id === eventId);
    toast.success(
      seriesId
        ? `Added "${evt?.name || "event"}" to the series.`
        : `Removed "${evt?.name || "event"}" from the series.`,
    );
    if (usingDb) {
      setEventSeries(eventId, seriesId).then((saved) => {
        if (!saved) toast.error("Couldn't update the event on the server.");
      });
    }
  };

  const handlePatchEvent = (eventId, patch) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
    );
    if (usingDb) updateEvent(eventId, patch);
  };

  const handleCreateEventInSeries = (seriesId) => {
    const series = seriesList.find((s) => s.id === seriesId);
    const defaults = series?.settings?.defaults || {};
    const id = newId();
    const draftEvent = {
      id,
      name: `${series?.name || "Series"} event`,
      status: "Draft",
      type: defaults.type || "In-person",
      date: "2026-07-15",
      time: "18:00",
      venue: "TBD",
      address: "",
      city: "London",
      timezone: defaults.timezone || "Europe/London",
      capacity: defaults.capacity || 0,
      sold: 0,
      revenue: 0,
      visibility: defaults.visibility || "Public",
      organizer: defaults.organizer || "Ava Mitchell",
      summary: "",
      coverUrl: "",
      gallery: [],
      seriesId,
      createdBy: userId,
    };
    setEvents((prev) => [draftEvent, ...prev]);
    toast.success("Added a new draft event to the series.");
    if (usingDb) {
      createEvent(draftEvent).then((saved) => {
        if (!saved) toast.error("Couldn't create the event on the server.");
      });
    }
  };

  const selectedSeries = selectedId
    ? seriesList.find((s) => s.id === selectedId) || null
    : null;

  if (selectedSeries) {
    return (
      <SeriesDetailScreen
        series={selectedSeries}
        events={events}
        onBack={() => setSelectedId(null)}
        onPatchSeries={(patch) => handlePatchSeries(selectedSeries.id, patch)}
        onMergeSettings={(patch) =>
          handleMergeSettings(selectedSeries.id, patch)
        }
        onSetEventSeries={handleSetEventSeries}
        onPatchEvent={handlePatchEvent}
        onCreateEventInSeries={handleCreateEventInSeries}
        onOpenEvent={(id) => openEventInTab(id, "All Events")}
      />
    );
  }

  const columns = [
    {
      key: "name",
      header: "Series",
      render: (s) => {
        const count = (eventsBySeries[s.id] || []).length;
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{s.name}</span>
            <span className="text-xs text-text-secondary">
              {count} event{count === 1 ? "" : "s"}
              {s.description ? ` · ${s.description}` : ""}
            </span>
          </div>
        );
      },
    },
    {
      key: "cadence",
      header: "Cadence",
      render: (s) => <Badge variant="neutral">{s.cadence}</Badge>,
    },
    {
      key: "next",
      header: "Next event",
      render: (s) => {
        const next = nextDateFor(s.id);
        return (
          <span className="text-sm text-muted-foreground">
            {next ? formatDate(next) : "—"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusPill status={s.status} map={EVENT_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (s) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                aria-label={`Actions for ${s.name}`}
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
                onClick={() => setSelectedId(s.id)}
              >
                <Settings2 className="h-4 w-4" /> Manage
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-hover" />
              <DropdownMenuItem
                variant="destructive"
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                onClick={() => handleDelete(s)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Event Series"
        description="Group related events under one series. Attendees can follow the whole run, and you manage shared settings in one place."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> New series
          </Button>
        }
      />

      <StatsBar stats={stats} columns={3} />

      <Toolbar>
        <FilterDropdown
          value={status}
          onValueChange={setStatus}
          options={SERIES_STATUS_FILTER_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search series…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading series…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(s) => s.id}
          onRowClick={(s) => setSelectedId(s.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Layers}
                title={
                  seriesList.length
                    ? "No series match your filters"
                    : "No event series yet"
                }
                description={
                  seriesList.length
                    ? "Try clearing the search or filters, or create a new series."
                    : "Create a series to group recurring or themed events together."
                }
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> New series
                  </Button>
                }
              />
            </div>
          }
        />
      )}

      <CreateSeriesDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />
    </MainScreenWrapper>
  );
}

export default EventSeriesScreen;
