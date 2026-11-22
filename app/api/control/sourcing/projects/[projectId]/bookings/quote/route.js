import { withControl } from "@/lib/control/http";
import { readJson } from "@/lib/control/scope";
import { checkRequest, quoteView } from "@/lib/control/sourcing/booking_slot";
import { parseBookingRequest } from "@/lib/control/sourcing/bookings";
import { sourcingProject } from "@/lib/control/sourcing/scope";

// POST — whether a slot can be booked and what it costs, using the dashboard's own rules, clash check and pricing.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await sourcingProject(ctx, projectId);
    const input = parseBookingRequest(await readJson(request));
    const { check, timeZone } = await checkRequest(db, projectId, input);
    return { ok: check.ok, message: check.message || "", quote: quoteView(check.quote), timeZone };
  });
}
