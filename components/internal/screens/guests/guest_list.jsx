"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, UserCheck, UserPlus } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listGuests, createContact, updateContact } from "@/lib/supabase/contacts";
import { listSegments, updateSegment } from "@/lib/supabase/segments";
import { getUser } from "@/lib/supabase/user";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import {
  GUEST_STATUS_MAP,
  formatDateTime,
  initials,
} from "./constants";
import { ContactDrawer } from "./contact_drawer";

// The latest (most recent) status wins for a guest's pill.
function latestStatus(guest) {
  const sorted = [...(guest.events || [])].sort((a, b) =>
    (b.at || "").localeCompare(a.at || ""),
  );
  return sorted[0]?.status || null;
}

export function GuestListScreen() {
  const [guests, setGuests] = useState([]);
  const [events, setEvents] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [openContact, setOpenContact] = useState(null);
  const [userId, setUserId] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([
      listGuests(projectId),
      listEvents(projectId),
      listSegments(projectId),
    ]).then(([gs, evs, sg]) => {
      if (!alive) return;
      setGuests(gs ?? []);
      setEvents(evs ?? []);
      setSegments(sg ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventById = useMemo(() => {
    const m = {};
    for (const e of events) m[e.id] = e;
    return m;
  }, [events]);

  const eventFilterOptions = useMemo(
    () => [
      { value: "all", label: "All events" },
      ...events.map((e) => ({ value: e.id, label: e.name })),
    ],
    [events],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (eventFilter !== "all" && !g.eventIds.includes(eventFilter)) return false;
      if (q) {
        const hay = `${g.name} ${g.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [guests, search, eventFilter]);

  const stats = useMemo(() => {
    const total = guests.length;
    const going = guests.filter((g) => g.going).length;
    const repeat = guests.filter((g) => g.eventsCount > 1).length;
    const covered = new Set(guests.flatMap((g) => g.eventIds)).size;
    return [
      { label: "Guests", value: total.toLocaleString() },
      { label: "Going", value: going.toLocaleString() },
      { label: "Repeat guests", value: repeat.toLocaleString() },
      { label: "Events covered", value: covered.toLocaleString() },
    ];
  }, [guests]);

  const filtersActive = eventFilter !== "all" || Boolean(search.trim());

  const handleExport = () => {
    if (!filtered.length) {
      toast.error("No guests to export.");
      return;
    }
    downloadCsv(
      [
        { header: "Name", value: (g) => g.name },
        { header: "Email", value: (g) => g.email },
        { header: "Phone", value: (g) => g.phone },
        { header: "Events", value: (g) => g.eventsCount },
        { header: "Latest status", value: (g) => latestStatus(g) || "" },
        { header: "In contacts", value: (g) => (g.contactId ? "Yes" : "No") },
        { header: "Last seen", value: (g) => formatDateTime(g.lastSeenAt) },
      ],
      filtered,
      "guest-list.csv",
    );
    toast.success(`Exported ${filtered.length} guests.`);
  };

  // Create a contact-book record from a derived guest, then link it locally.
  const handleAddToContacts = async (guest) => {
    const draft = {
      id: crypto.randomUUID(),
      projectId,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      status: "Active",
      createdBy: userId,
    };
    setGuests((prev) =>
      prev.map((g) =>
        g.email === guest.email
          ? { ...g, contactId: draft.id, contact: { ...draft, tags: [], notes: [], metadata: {} } }
          : g,
      ),
    );
    toast.success(`Added ${guest.name || guest.email} to contacts.`);
    const saved = await createContact(draft);
    if (saved) {
      setGuests((prev) =>
        prev.map((g) =>
          g.email === guest.email ? { ...g, contactId: saved.id, contact: saved } : g,
        ),
      );
    }
  };

  // Patch a linked contact from the drawer; reflect it back onto the guest row.
  const handlePatch = (id, patch) => {
    const withNotes = (c) => {
      const next = { ...c, ...patch };
      if (patch.metadata) {
        next.notes = Array.isArray(patch.metadata.notes)
          ? patch.metadata.notes
          : [];
      }
      return next;
    };
    setOpenContact((c) => (c && c.id === id ? withNotes(c) : c));
    setGuests((prev) =>
      prev.map((g) =>
        g.contactId === id ? { ...g, contact: withNotes(g.contact) } : g,
      ),
    );
    updateContact(id, patch).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the change.");
    });
  };

  const openGuestDrawer = (guest) => {
    if (!guest.contact) return;
    setOpenContact(guest.contact);
  };

  // Manually add/remove the linked contact to a segment (stored in the
  // segment's manualIds; membership ORs these with the rule matches).
  const handleToggleSegment = (contactId, segmentId) => {
    const seg = segments.find((s) => s.id === segmentId);
    if (!seg) return;
    const has = (seg.manualIds || []).includes(contactId);
    const manualIds = has
      ? seg.manualIds.filter((x) => x !== contactId)
      : [...(seg.manualIds || []), contactId];
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, manualIds } : s)),
    );
    toast.success(has ? `Removed from ${seg.name}.` : `Added to ${seg.name}.`);
    updateSegment(segmentId, { manualIds }).then((res) => {
      if (res === false) toast.error("Couldn't update the segment.");
    });
  };

  const drawerAttendedEvents = useMemo(() => {
    if (!openContact) return [];
    const g = guests.find((x) => x.contactId === openContact.id);
    if (!g) return [];
    return (g.events || []).map((ev) => ({
      id: ev.eventId,
      name: eventById[ev.eventId]?.name || "Event",
      date: eventById[ev.eventId]?.date || "",
      status: ev.status,
    }));
  }, [openContact, guests, eventById]);

  const columns = [
    {
      key: "guest",
      header: "Guest",
      render: (g) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
            {initials(g.name, g.email) || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {g.name || "Unnamed"}
            </p>
            <p className="truncate text-xs text-text-secondary">
              {g.email || "No email"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "events",
      header: "Events",
      render: (g) => (
        <span
          className="text-sm text-foreground"
          title={g.eventIds.map((id) => eventById[id]?.name || "Event").join(", ")}
        >
          {g.eventsCount}
          <span className="text-text-secondary">
            {" "}
            {g.eventsCount === 1 ? "event" : "events"}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Latest status",
      render: (g) => {
        const s = latestStatus(g);
        return s ? <StatusPill status={s} map={GUEST_STATUS_MAP} /> : "—";
      },
    },
    {
      key: "contact",
      header: "",
      align: "right",
      render: (g) =>
        g.contactId ? (
          <Badge variant="info">In contacts</Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleAddToContacts(g);
            }}
          >
            <UserPlus className="h-3.5 w-3.5" /> Add
          </Button>
        ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Guest List"
        description="Everyone attending across your events. Filter by event for a who's-going roster, or export the attendee list."
        actions={
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={handleExport}
          >
            <Download className="h-4 w-4" /> Export attendees
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={eventFilter}
          onValueChange={setEventFilter}
          options={eventFilterOptions}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or email…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading guests…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(g) => g.id}
          onRowClick={openGuestDrawer}
          empty={
            <EmptyState
              icon={UserCheck}
              title={
                filtersActive ? "No guests match your filters" : "No guests yet"
              }
              description={
                filtersActive
                  ? "Try a different event or search."
                  : "As people register or buy tickets for your events, they appear here as guests."
              }
              action={
                filtersActive ? (
                  <Button
                    variant="outline"
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => {
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

      <ContactDrawer
        contact={openContact}
        projectId={projectId}
        userId={userId}
        attendedEvents={drawerAttendedEvents}
        segments={segments}
        onPatch={handlePatch}
        onDelete={() => {
          toast.message("Delete contacts from the Contact Book.");
          setOpenContact(null);
        }}
        onToggleSegment={handleToggleSegment}
        onClose={() => setOpenContact(null)}
      />
    </MainScreenWrapper>
  );
}

export default GuestListScreen;
