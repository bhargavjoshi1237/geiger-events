"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Copy,
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
import { newId } from "@/components/internal/screens/events/sample_data";
import {
  listVenues,
  createVenue,
  updateVenue,
  softDeleteVenue,
} from "@/lib/supabase/venues";
import { getUser } from "@/lib/supabase/user";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useProject } from "@/context/project-context";
import {
  VENUE_STATUS_MAP,
  VENUE_TYPE_MAP,
  VENUE_STATUS_FILTER_OPTIONS,
  VENUE_TYPE_FILTER_OPTIONS,
  VENUE_TYPE_OPTIONS,
  venueCapacity,
  venueLocation,
} from "./constants";
import { VenueDetailScreen } from "./venue_detail";

const EMPTY_DRAFT = { name: "", type: "Indoor", city: "" };

function CreateVenueDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give your venue a name first.");
      return;
    }
    onCreate({ ...draft });
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>Add venue</DialogTitle>
          <DialogDescription>
            Set the essentials now — you can add location, capacity, amenities,
            and photos in the venue editor.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Venue name" htmlFor="venue-name">
            <Input
              id="venue-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. The Glasshouse"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select value={draft.type} onValueChange={set("type")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="City">
              <Input
                value={draft.city}
                onChange={(e) => set("city")(e.target.value)}
                placeholder="e.g. London"
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
            Add venue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VenuesScreen() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // The open venue lives in the URL (?venue=<id>) so a refresh stays on it.
  const { venueId, openVenue, closeVenue } = useWorkspaceUrl();
  const { projectId } = useProject();
  const [userId, setUserId] = useState(null);

  const selectedVenue = useMemo(
    () => (venueId ? venues.find((v) => v.id === venueId) || null : null),
    [venueId, venues],
  );

  useEffect(() => {
    let alive = true;
    listVenues(projectId).then((rows) => {
      if (!alive) return;
      setVenues(rows ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    return venues.filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (type !== "all" && v.type !== type) return false;
      if (
        search &&
        !`${v.name} ${v.city} ${v.address} ${v.region}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [venues, search, status, type]);

  const stats = useMemo(() => {
    const active = venues.filter((v) => v.status === "Active").length;
    const capacity = venues.reduce((s, v) => s + venueCapacity(v), 0);
    const cities = new Set(
      venues.map((v) => (v.city || "").trim().toLowerCase()).filter(Boolean),
    ).size;
    return [
      { label: "Total venues", value: String(venues.length), footer: `${active} active` },
      { label: "Total capacity", value: capacity.toLocaleString(), footer: "Across all venues" },
      { label: "Active", value: String(active), footer: "Bookable now" },
      { label: "Cities", value: String(cities), footer: "Distinct locations" },
    ];
  }, [venues]);

  const persistCreate = (venue) => {
    createVenue(venue).then((saved) => {
      if (!saved) {
        toast.error("Couldn't save the venue to the server.");
      } else {
        setVenues((prev) => prev.map((v) => (v.id === saved.id ? saved : v)));
      }
    });
  };

  const handleCreate = (draft) => {
    const newVenue = {
      id: newId(),
      name: draft.name.trim(),
      type: draft.type || "Indoor",
      status: "Active",
      description: "",
      address: "",
      city: draft.city || "",
      region: "",
      postcode: "",
      country: "",
      timezone: "Europe/London",
      latitude: null,
      longitude: null,
      parkingNotes: "",
      transitNotes: "",
      seatedCapacity: 0,
      standingCapacity: 0,
      spaces: 1,
      amenities: [],
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      website: "",
      coverUrl: "",
      gallery: [],
      createdBy: userId,
      projectId,
    };
    setVenues((prev) => [newVenue, ...prev]);
    toast.success(`"${newVenue.name}" added.`);
    persistCreate(newVenue);
  };

  const handleUpdate = (updated) => {
    setVenues((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    updateVenue(updated.id, updated).then((saved) => {
      if (!saved) toast.error("Couldn't save your changes to the server.");
    });
  };

  const handleDelete = (venue) => {
    setDeleteTarget(null);
    setVenues((prev) => prev.filter((v) => v.id !== venue.id));
    toast.success(`Deleted "${venue.name}".`);
    softDeleteVenue(venue.id).then((ok) => {
      if (!ok) toast.error("Couldn't delete the venue on the server.");
    });
  };

  const handleDuplicate = (venue) => {
    const copy = {
      ...venue,
      id: newId(),
      name: `${venue.name} (copy)`,
      createdBy: userId,
      projectId,
      coverUrl: "",
      gallery: [],
    };
    setVenues((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${venue.name}".`);
    persistCreate(copy);
  };

  const columns = [
    {
      key: "name",
      header: "Venue",
      render: (v) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{v.name}</span>
          <span className="text-xs text-text-secondary">
            {venueLocation(v) || "No location set"}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (v) => (
        <Badge variant={VENUE_TYPE_MAP[v.type]?.variant || "neutral"}>
          {v.type}
        </Badge>
      ),
    },
    {
      key: "capacity",
      header: "Capacity",
      align: "right",
      className: "text-right tabular-nums text-muted-foreground",
      render: (v) => {
        const cap = venueCapacity(v);
        return cap ? cap.toLocaleString() : "—";
      },
    },
    {
      key: "status",
      header: "Status",
      render: (v) => <StatusPill status={v.status} map={VENUE_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (v) => (
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
                onClick={() => openVenue(v.id)}
              >
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => handleDuplicate(v)}
              >
                <Copy className="h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => setDeleteTarget(v)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (selectedVenue) {
    return (
      <VenueDetailScreen
        venue={selectedVenue}
        onBack={closeVenue}
        onUpdate={handleUpdate}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Venues"
        description="Reusable places you host events at — with location, capacity, amenities, and contacts. Pick a venue when creating an event to fill everything in."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add venue
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={VENUE_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={type}
            onValueChange={setType}
            options={VENUE_TYPE_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search venues, cities…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading venues…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(v) => v.id}
          onRowClick={(v) => openVenue(v.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Building2}
                title={venues.length ? "No venues match your filters" : "No venues yet"}
                description={
                  venues.length
                    ? "Try clearing the search or filters, or add a new venue."
                    : "Add your first venue to reuse it across events — location, capacity, amenities, and contacts in one place."
                }
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Add venue
                  </Button>
                }
              />
            </div>
          }
        />
      )}

      <CreateVenueDialog
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
            <DialogTitle>Delete venue</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? Events already linked keep their saved address. This can&apos;t be
              undone.
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

export default VenuesScreen;
