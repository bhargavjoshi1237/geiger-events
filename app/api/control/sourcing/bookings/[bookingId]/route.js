import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { bookingViews } from "@/lib/control/sourcing/booking_data";
import { parseBookingPatch } from "@/lib/control/sourcing/bookings";
import { bookingScope } from "@/lib/control/sourcing/scope";
import { normalizeVenueBooking } from "@/lib/venue_booking/normalize";

export async function GET(request, { params }) {
  const { bookingId } = await params;
  return withControl(request, async (ctx) => {
    const { db, booking } = await bookingScope(ctx, bookingId);
    const [view] = await bookingViews(db, [booking]);
    return { booking: view };
  });
}

// PATCH { title?, contactName?, contactEmail?, contactPhone?, notes? } — the only columns members edit directly.
export async function PATCH(request, { params }) {
  const { bookingId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseBookingPatch(await readJson(request));
    const { db, booking } = await bookingScope(ctx, bookingId);
    const updated = must(await db.from("venue_bookings").update(patch).eq("id", booking.id).select("*").single(), "bookings.update");
    const [view] = await bookingViews(db, [normalizeVenueBooking(updated)]);
    return { booking: view };
  });
}
