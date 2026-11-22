import { withControl } from "@/lib/control/http";
import { readJson } from "@/lib/control/scope";
import { bookingViews } from "@/lib/control/sourcing/booking_data";
import { sendBookingEmail } from "@/lib/control/sourcing/booking_email";
import { EMAIL_KINDS } from "@/lib/control/sourcing/bookings";
import { bookingScope } from "@/lib/control/sourcing/scope";
import { normalizeVenueBooking } from "@/lib/venue_booking/normalize";
import { ApiError } from "@/lib/staff_access/errors";

// POST { kind: confirmation | hold | cancellation } — resends a booking email to the venue contact and the booker.
export async function POST(request, { params }) {
  const { bookingId } = await params;
  return withControl(request, async (ctx) => {
    const { kind } = await readJson(request);
    if (!EMAIL_KINDS.includes(kind)) throw new ApiError("invalid_input", 400, "Pick which email to send.");
    const { db, row, booking } = await bookingScope(ctx, bookingId);
    const email = await sendBookingEmail({ db, request, row, booking, kind });
    const fresh = await db.from("venue_bookings").select("*").eq("id", booking.id).maybeSingle();
    const [view] = await bookingViews(db, [fresh.data ? normalizeVenueBooking(fresh.data) : booking]);
    return { booking: view, email };
  });
}
