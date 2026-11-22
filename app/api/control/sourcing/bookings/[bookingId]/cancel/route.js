import { withControl } from "@/lib/control/http";
import { readJson } from "@/lib/control/scope";
import { runBookingRpc } from "@/lib/control/sourcing/booking_actions";
import { bookingScope } from "@/lib/control/sourcing/scope";

// POST { reason?, notify? } — frees the slot through cancel_venue_booking; the cancellation email is optional, as on the dashboard.
export async function POST(request, { params }) {
  const { bookingId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const { db, booking } = await bookingScope(ctx, bookingId);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    return runBookingRpc({
      db,
      request,
      booking,
      rpc: "cancel_venue_booking",
      args: { p_reason: reason },
      label: "cancel",
      emailKind: body.notify === true ? "cancellation" : null,
    });
  });
}
