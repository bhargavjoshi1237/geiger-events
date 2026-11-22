import { normalizeVenueBooking } from "../../venue_booking/normalize.js";
import { must } from "../scope.js";
import { bookingView } from "./bookings.js";

const HISTORY_DAYS = 400;
const DAY = 86_400_000;

// Names for a set of bookings, looked up by id so bookings at since-deleted spaces or venues still read properly.
async function namesFor(db, bookings) {
  const ids = (key) => [...new Set(bookings.map((b) => b[key]).filter(Boolean))];
  const [spaces, venues, events] = await Promise.all([
    ids("spaceId").length ? db.from("venue_spaces").select("id,name").in("id", ids("spaceId")) : { data: [], error: null },
    ids("venueId").length ? db.from("venues").select("id,name,address,city,postcode,country").in("id", ids("venueId")) : { data: [], error: null },
    ids("eventId").length ? db.from("events").select("id,name").in("id", ids("eventId")) : { data: [], error: null },
  ]);
  return {
    space: new Map(must(spaces, "bookings.spaces").map((s) => [s.id, s])),
    venue: new Map(must(venues, "bookings.venues").map((v) => [v.id, v])),
    event: new Map(must(events, "bookings.events").map((e) => [e.id, e])),
  };
}

export async function bookingViews(db, bookings, now = Date.now()) {
  const names = await namesFor(db, bookings);
  return bookings.map((b) => {
    const venue = names.venue.get(b.venueId);
    return bookingView(
      b,
      {
        spaceName: names.space.get(b.spaceId)?.name || "Venue space",
        venueName: venue?.name || "",
        venueAddress: [venue?.address, venue?.city, venue?.postcode, venue?.country].filter(Boolean).join(", "),
        eventName: names.event.get(b.eventId)?.name || "",
      },
      now,
    );
  });
}

// The project's bookings over the dashboard's history window, newest first.
export async function projectBookings(db, projectId, now = Date.now()) {
  const rows = must(
    await db
      .from("venue_bookings")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .gte("ends_at", new Date(now - HISTORY_DAYS * DAY).toISOString())
      .order("starts_at", { ascending: false })
      .limit(1000),
    "bookings.list",
  );
  return rows.map(normalizeVenueBooking);
}

// Bookings that can still block a space, for the availability check.
export async function spaceBookings(db, spaceId, now = Date.now()) {
  const rows = must(
    await db.from("venue_bookings").select("*").eq("space_id", spaceId).is("deleted_at", null).neq("status", "cancelled").gte("ends_at", new Date(now - DAY).toISOString()),
    "bookings.space",
  );
  return rows.map(normalizeVenueBooking);
}
