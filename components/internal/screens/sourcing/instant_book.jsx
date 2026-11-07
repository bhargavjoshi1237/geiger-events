"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, CalendarCheck, DoorOpen, Eye, Mail, Zap } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { ActionMenu, LogoLoading } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";
import { getVenue, listVenues } from "@/lib/supabase/venues";
import { getVenueSpace, listVenueSpaces } from "@/lib/supabase/venue_spaces";
import {
  cancelVenueBooking,
  confirmVenueBooking,
  listVenueBookings,
  sendVenueBookingEmail,
} from "@/lib/supabase/venue_bookings";
import { bookingDisplayStatus, isLiveHold } from "@/lib/venue_booking/availability";
import { formatMoney } from "@/lib/venue_booking/pricing";
import {
  DAY_MS,
  HOUR_MS,
  addDays,
  clockString,
  formatInZone,
  formatRange,
  todayIn,
  zoneAbbreviation,
} from "@/lib/venue_booking/time";

import { AvailabilityTimeline } from "./availability_timeline";
import { BookingDialog } from "./booking_dialog";
import { BookingDrawer, CancelBookingDialog } from "./booking_drawer";
import { BOOKING_FILTER_OPTIONS, BOOKING_STATUS_MAP, moneyByCurrency } from "./instant_book_constants";
import { SearchPanel } from "./search_panel";

const EMPTY = { venues: [], spaces: [], bookings: [], events: [], extraSpaces: [], extraVenues: [] };
const HISTORY_DAYS = 400;

// Hours of [start, end) that fall inside [from, to).
const overlapHours = (start, end, from, to) =>
  Math.max(0, Math.min(new Date(end).getTime(), to) - Math.max(new Date(start).getTime(), from)) / HOUR_MS;

function emailToast(res, kind) {
  if (res.ok) {
    const to = res.sent.filter((s) => s.status === "sent").map((s) => s.to);
    toast.success(`${kind === "cancellation" ? "Cancellation" : kind === "hold" ? "Hold notice" : "Confirmation"} emailed to ${to.join(", ")}.`);
  } else {
    toast.error(`Email not sent: ${res.error || "unknown error"}`);
  }
}

export function InstantBookScreen() {
  const { projectId } = useProject();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState(() => {
    const tomorrow = todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date(Date.now() + DAY_MS));
    return { date: tomorrow, startTime: "09:00", endDate: tomorrow, endTime: "17:00", attendees: "", style: "any", venueId: "all" };
  });
  const [anchor, setAnchor] = useState(() => search.date);
  const [mode, setMode] = useState("week");
  const [seed, setSeed] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [filter, setFilter] = useState("upcoming");
  const [query, setQuery] = useState("");

  // Holds expire on their own; re-evaluate statuses every minute.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    getUser().then((u) => alive && setUser(u));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    const since = Date.now() - HISTORY_DAYS * DAY_MS;
    Promise.all([
      listVenues(projectId),
      listVenueSpaces(projectId),
      listVenueBookings(projectId, { since }),
      listEvents(projectId),
    ]).then(async ([venues, spaces, bookings, events]) => {
      const v = venues ?? [];
      const s = spaces ?? [];
      const b = bookings ?? [];
      // Bookings outlive deleted spaces/venues; fetch those by id so rows still have names.
      const knownSpaces = new Set(s.map((x) => x.id));
      const knownVenues = new Set(v.map((x) => x.id));
      const missingSpaces = [...new Set(b.map((x) => x.spaceId).filter((id) => id && !knownSpaces.has(id)))];
      const missingVenues = [...new Set(b.map((x) => x.venueId).filter((id) => id && !knownVenues.has(id)))];
      const [extraSpaces, extraVenues] = await Promise.all([
        Promise.all(missingSpaces.map(getVenueSpace)),
        Promise.all(missingVenues.map(getVenue)),
      ]);
      if (!alive) return;
      setData({
        venues: v,
        spaces: s,
        bookings: b,
        events: events ?? [],
        extraSpaces: extraSpaces.filter(Boolean),
        extraVenues: extraVenues.filter(Boolean),
      });
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const venueById = useMemo(() => new Map([...data.extraVenues, ...data.venues].map((v) => [v.id, v])), [data.venues, data.extraVenues]);
  const spaceById = useMemo(() => new Map([...data.extraSpaces, ...data.spaces].map((s) => [s.id, s])), [data.spaces, data.extraSpaces]);
  const eventById = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data.events]);

  // Instant Book only offers bookable spaces at venues that still exist.
  const bookableSpaces = useMemo(
    () => data.spaces.filter((s) => s.bookable && data.venues.some((v) => v.id === s.venueId)),
    [data.spaces, data.venues],
  );
  const bookableVenues = useMemo(
    () => data.venues.filter((v) => bookableSpaces.some((s) => s.venueId === v.id)),
    [data.venues, bookableSpaces],
  );
  const timelineSpaces = useMemo(
    () => (search.venueId === "all" ? bookableSpaces : bookableSpaces.filter((s) => s.venueId === search.venueId)),
    [bookableSpaces, search.venueId],
  );

  const stats = useMemo(() => {
    const confirmed = data.bookings.filter((b) => b.status === "confirmed");
    const upcoming = confirmed.filter((b) => new Date(b.endsAt).getTime() > now);
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const hours = confirmed.reduce((s, b) => s + overlapHours(b.startsAt, b.endsAt, monthStart.getTime(), monthEnd.getTime()), 0);
    const holds = data.bookings.filter((b) => isLiveHold(b, now));
    const soon = holds.filter((b) => new Date(b.holdExpiresAt).getTime() - now < DAY_MS).length;
    const value = moneyByCurrency(confirmed);
    const next = [...upcoming].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
    const nextTz = next ? next.timezone : "UTC";
    return [
      {
        label: "Upcoming bookings",
        value: String(upcoming.length),
        footer: next ? `Next ${formatInZone(next.startsAt, nextTz, { weekday: "short", day: "numeric", month: "short" })}` : "Nothing booked yet",
      },
      {
        label: "Hours booked",
        value: `${Math.round(hours * 10) / 10}`,
        footer: `Confirmed in ${monthStart.toLocaleDateString("en-GB", { month: "long" })}`,
      },
      { label: "Active holds", value: String(holds.length), footer: soon ? `${soon} expire within 24 h` : "Provisional, not confirmed" },
      {
        label: "Booked value",
        value: value.value,
        footer: value.others ? `+${value.others} other currenc${value.others === 1 ? "y" : "ies"}` : "Confirmed bookings",
      },
    ];
  }, [data.bookings, now]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.bookings
      .map((b) => ({ ...b, displayStatus: bookingDisplayStatus(b, now) }))
      .filter((b) => {
        if (filter === "upcoming") {
          if (b.status === "cancelled" || new Date(b.endsAt).getTime() <= now) return false;
        } else if (filter !== "all" && b.displayStatus !== filter) {
          return false;
        }
        if (!q) return true;
        const space = spaceById.get(b.spaceId);
        const venue = venueById.get(b.venueId);
        const event = eventById.get(b.eventId);
        return `${b.reference} ${b.title} ${space?.name || ""} ${venue?.name || ""} ${event?.name || ""} ${b.contactName} ${b.contactEmail}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        filter === "upcoming" ? new Date(a.startsAt) - new Date(b.startsAt) : new Date(b.startsAt) - new Date(a.startsAt),
      );
  }, [data.bookings, filter, query, now, spaceById, venueById, eventById]);

  const pager = usePagination(rows, { resetKey: `${filter}|${query}` });

  const openBooking = useMemo(() => (openId ? data.bookings.find((b) => b.id === openId) || null : null), [openId, data.bookings]);

  const upsertBooking = (booking) =>
    setData((d) => ({
      ...d,
      bookings: d.bookings.some((b) => b.id === booking.id)
        ? d.bookings.map((b) => (b.id === booking.id ? booking : b))
        : [booking, ...d.bookings],
    }));

  // Emails re-read the booking server-side, then log onto it; mirror that log locally.
  const notify = async (booking, kind) => {
    const res = await sendVenueBookingEmail(booking.id, kind);
    emailToast(res, kind);
    if (res.sent?.length) {
      const at = new Date().toISOString();
      const entries = res.sent.map((s) => ({ ...s, kind, at }));
      setData((d) => ({
        ...d,
        bookings: d.bookings.map((b) =>
          b.id === booking.id
            ? { ...b, metadata: { ...b.metadata, emails: [...entries, ...(b.metadata?.emails || [])].slice(0, 20) } }
            : b,
        ),
      }));
    }
  };

  const handleBooked = (booking, { notify: shouldNotify }) => {
    upsertBooking(booking);
    setOpenId(booking.id);
    toast.success(
      booking.status === "hold"
        ? `Hold ${booking.reference} placed.`
        : `Booked ${booking.reference} · ${formatMoney(booking.total, booking.currency)}.`,
    );
    if (shouldNotify) notify(booking, booking.status === "hold" ? "hold" : "confirmation");
  };

  const handleConfirm = async (booking) => {
    const res = await confirmVenueBooking(booking.id);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    upsertBooking(res.booking);
    toast.success(`${res.booking.reference} confirmed.`);
    await notify(res.booking, "confirmation");
  };

  const handleResend = (booking) => notify(booking, booking.status === "hold" ? "hold" : "confirmation");

  const handleCancel = async (booking, { reason, notify: shouldNotify }) => {
    const res = await cancelVenueBooking(booking.id, reason);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    upsertBooking(res.booking);
    toast.success(`${res.booking.reference} cancelled.`);
    if (shouldNotify) await notify(res.booking, "cancellation");
  };

  const startBooking = (partial) =>
    setSeed({
      key: `${Date.now()}`,
      date: search.date,
      startTime: search.startTime,
      endDate: search.endDate,
      endTime: search.endTime,
      setupStyle: search.style === "any" ? "" : search.style,
      attendees: search.attendees,
      ...partial,
    });

  const onSlotClick = ({ spaceId, date, minute }) => {
    const space = spaceById.get(spaceId);
    const length = Math.max(60, Math.ceil((Number(space?.minHours) || 1) * 2) * 30);
    const endMinute = Math.min(minute + length, 24 * 60);
    startBooking({
      spaceId,
      date,
      startTime: clockString(minute),
      endDate: endMinute >= 24 * 60 ? addDays(date, 1) : date,
      endTime: clockString(endMinute % (24 * 60)),
    });
  };

  const onSearchChange = (next) => {
    if (next.date !== search.date && next.date) setAnchor(next.date);
    setSearch(next);
  };

  const columns = [
    {
      key: "reference",
      header: "Booking",
      render: (b) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <CalendarCheck className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium text-foreground">{b.title || "Venue booking"}</span>
            <span className="text-xs text-text-secondary">{b.reference}</span>
          </div>
        </div>
      ),
    },
    {
      key: "space",
      header: "Venue / space",
      render: (b) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm text-foreground">{spaceById.get(b.spaceId)?.name || "Deleted space"}</span>
          <span className="truncate text-xs text-text-secondary">{venueById.get(b.venueId)?.name || "—"}</span>
        </div>
      ),
    },
    {
      key: "when",
      header: "When",
      render: (b) => (
        <span className="text-sm text-text-secondary">
          {formatRange(b.startsAt, b.endsAt, b.timezone)}
          <span className="ml-1 text-xs text-text-tertiary">{zoneAbbreviation(b.startsAt, b.timezone)}</span>
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (b) => <span className="text-sm text-text-secondary">{eventById.get(b.eventId)?.name || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (b) => <StatusPill status={b.displayStatus} map={BOOKING_STATUS_MAP} />,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "text-right font-semibold tabular-nums text-foreground dark:text-white",
      render: (b) => (
        <span className={b.status === "cancelled" ? "text-text-tertiary line-through" : ""}>{formatMoney(b.total, b.currency)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (b) => (
        <ActionMenu
          label={`Actions for ${b.reference}`}
          items={[
            { icon: Eye, label: "View booking", onSelect: () => setOpenId(b.id) },
            ...(b.status === "hold" ? [{ icon: CalendarCheck, label: "Confirm hold", onSelect: () => handleConfirm(b) }] : []),
            ...(b.status !== "cancelled"
              ? [{ icon: Mail, label: "Resend email", onSelect: () => handleResend(b) }]
              : []),
            ...(b.status !== "cancelled" && b.displayStatus !== "Completed"
              ? [
                  { separator: true },
                  { icon: Ban, label: "Cancel booking", variant: "destructive", onSelect: () => setCancelTarget(b) },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  const openSpace = openBooking ? spaceById.get(openBooking.spaceId) : null;
  const openVenue = openBooking ? venueById.get(openBooking.venueId) : null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Instant Book"
        description="Book your own venues' spaces at their published rates — live availability, holds and confirmations, with the venue emailed automatically."
      />

      <StatsBar stats={stats} />

      {loading && projectId ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} />
        </div>
      ) : (
        <>
          {bookableSpaces.length ? (
            <>
              <SearchPanel
                search={search}
                onChange={onSearchChange}
                venues={bookableVenues}
                spaces={bookableSpaces}
                venueById={venueById}
                bookings={data.bookings}
                now={now}
                onBook={(row) => startBooking({ spaceId: row.space.id })}
              />
              <SectionCard
                title="Availability"
                description={`${timelineSpaces.length} bookable space${timelineSpaces.length === 1 ? "" : "s"}${
                  search.venueId === "all" ? "" : ` at ${venueById.get(search.venueId)?.name || "this venue"}`
                }. Bookings, holds and turnover time by day.`}
              >
                <AvailabilityTimeline
                  spaces={timelineSpaces}
                  venueById={venueById}
                  bookings={data.bookings}
                  now={now}
                  anchor={anchor}
                  onAnchorChange={setAnchor}
                  mode={mode}
                  onModeChange={setMode}
                  onSlotClick={onSlotClick}
                  onBookingClick={(b) => setOpenId(b.id)}
                />
              </SectionCard>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={DoorOpen}
                title="No bookable spaces yet"
                description="Open a venue in Venues, add its rooms under Spaces & booking, give them a rate and switch on Instant Book."
              />
            </div>
          )}

          <div className="space-y-4">
            <Toolbar>
              <FilterDropdown value={filter} onValueChange={setFilter} options={BOOKING_FILTER_OPTIONS} height="h-9" />
              <SearchInput value={query} onChange={setQuery} placeholder="Search reference, space, event, contact…" />
            </Toolbar>
            <DataTable
              columns={columns}
              data={pager.pageItems}
              getRowKey={(b) => b.id}
              onRowClick={(b) => setOpenId(b.id)}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={Zap}
                    title={data.bookings.length ? "No bookings match" : "No bookings yet"}
                    description={
                      data.bookings.length
                        ? "Try another filter or clear the search."
                        : "Bookings and holds you make here show up in this list."
                    }
                  />
                </div>
              }
            />
            <ListPagination {...pager} itemLabel="bookings" />
          </div>
        </>
      )}

      <BookingDialog
        open={!!seed}
        onOpenChange={(o) => !o && setSeed(null)}
        seed={seed}
        spaces={bookableSpaces}
        venueById={venueById}
        events={data.events}
        bookings={data.bookings}
        now={now}
        user={user}
        onBooked={handleBooked}
      />

      <BookingDrawer
        booking={openBooking}
        space={openSpace}
        venue={openVenue}
        events={data.events}
        now={now}
        onOpenChange={(o) => !o && setOpenId(null)}
        onChanged={upsertBooking}
        onConfirm={handleConfirm}
        onResend={handleResend}
        onCancel={setCancelTarget}
      />

      <CancelBookingDialog
        key={cancelTarget?.id || "none"}
        booking={cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        onConfirm={handleCancel}
      />
    </MainScreenWrapper>
  );
}

export default InstantBookScreen;
