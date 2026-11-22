import { withControl } from "@/lib/control/http";
import { runBookingRpc } from "@/lib/control/sourcing/booking_actions";
import { bookingScope } from "@/lib/control/sourcing/scope";

// POST — turns a live hold into a confirmed booking and emails the confirmation, as the dashboard's Confirm does.
export async function POST(request, { params }) {
  const { bookingId } = await params;
  return withControl(request, async (ctx) => {
    const { db, booking } = await bookingScope(ctx, bookingId);
    return runBookingRpc({ db, request, booking, rpc: "confirm_venue_booking", args: {}, label: "confirm", emailKind: "confirmation" });
  });
}
