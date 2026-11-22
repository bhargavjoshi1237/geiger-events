import { withControl } from "@/lib/control/http";
import { readJson } from "@/lib/control/scope";
import { sendBookingEmail } from "@/lib/control/sourcing/booking_email";
import { bookingViews, projectBookings } from "@/lib/control/sourcing/booking_data";
import { checkRequest } from "@/lib/control/sourcing/booking_slot";
import { BOOKING_FILTERS, bookingStats, filterBookings, parseBookingRequest } from "@/lib/control/sourcing/bookings";
import { assertProjectEvent, sourcingProject } from "@/lib/control/sourcing/scope";
import { normalizeVenueBooking } from "@/lib/venue_booking/normalize";
import { ApiError } from "@/lib/staff_access/errors";

// GET ?filter=upcoming|all|Hold|Confirmed|Hold expired|Completed|Cancelled&q= — bookings and the dashboard's four figures.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await sourcingProject(ctx, projectId);
    const query = new URL(request.url).searchParams;
    const filter = BOOKING_FILTERS.includes(query.get("filter")) ? query.get("filter") : "upcoming";
    const now = Date.now();
    const bookings = await projectBookings(db, projectId, now);
    const rows = await bookingViews(db, bookings, now);
    return { bookings: filterBookings(rows, filter, query.get("q"), now), stats: bookingStats(bookings, now) };
  });
}

// POST — books or holds a slot through book_venue_space, which re-checks the slot and prices it from the stored rates.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await sourcingProject(ctx, projectId);
    const input = parseBookingRequest(await readJson(request));
    await assertProjectEvent(db, projectId, input.eventId);
    const { space, startsAt, endsAt, check } = await checkRequest(db, projectId, input);
    if (!check.ok) throw new ApiError("slot_unavailable", 409, check.message || "That slot can't be booked.");

    let eventName = "";
    if (input.eventId) {
      const { data } = await db.from("events").select("name").eq("id", input.eventId).maybeSingle();
      eventName = data?.name || "";
    }
    const { data, error } = await db.rpc("book_venue_space", {
      p_space_id: space.id,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_status: input.status,
      p_hold_hours: input.holdHours,
      p_event_id: input.eventId,
      p_title: input.title || eventName || `${space.name} booking`,
      p_setup_style: input.setupStyle,
      p_attendees: input.attendees,
      p_contact_name: input.contactName,
      p_contact_email: input.contactEmail,
      p_contact_phone: input.contactPhone,
      p_notes: input.notes,
    });
    if (error) {
      console.error("[control.sourcing.book]", error.message);
      throw new ApiError("booking_failed", 503, "Couldn't save the booking. Try again.");
    }
    const res = Array.isArray(data) ? data[0] : data;
    if (!res || res.ok !== true) throw new ApiError(res?.code || "booking_failed", 409, res?.message || "Couldn't save the booking.");
    const booking = normalizeVenueBooking(res.booking);

    let email = null;
    if (input.notify) {
      const row = await db.from("venue_bookings").select("*").eq("id", booking.id).maybeSingle();
      email = row.data
        ? await sendBookingEmail({ db, request, row: row.data, booking: normalizeVenueBooking(row.data), kind: booking.status === "hold" ? "hold" : "confirmation" })
        : { ok: false, sent: [], error: "Couldn't load the booking to email it." };
    }
    const [view] = await bookingViews(db, [booking]);
    return { booking: view, email };
  });
}
