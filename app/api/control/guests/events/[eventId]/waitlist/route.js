import { REGISTRATIONS } from "@/lib/control/guests/access";
import { parsePromoteCount, sortWaitlist, waitlistView } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

async function waitlist(db, eventId) {
  const rows = must(
    await db.from("registrations").select("id,name,email,party_size,waitlist_position,created_at").eq("event_id", eventId).eq("status", "Waitlisted").is("deleted_at", null).limit(2000),
    "waitlist.list",
  );
  return sortWaitlist(rows).map(waitlistView);
}

export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, REGISTRATIONS, { also: [CONTROL_CAPABILITIES.edit] });
    return { waitlist: await waitlist(scope.db, eventId), canPromote: Boolean(scope.allowed[CONTROL_CAPABILITIES.edit]) };
  });
}

// POST { count } — confirms the next N people in line through promote_waitlist, the dashboard's RPC; guests aren't emailed.
export async function POST(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const count = parsePromoteCount(await readJson(request));
    const scope = await eventScope(ctx, eventId, REGISTRATIONS, { also: [CONTROL_CAPABILITIES.edit] });
    if (!scope.allowed[CONTROL_CAPABILITIES.edit]) throw new ApiError("forbidden", 403, "Your role can't confirm people from the waitlist.");
    const promoted = must(await scope.db.rpc("promote_waitlist", { p_event_id: eventId, p_count: count }), "waitlist.promote");
    return { promoted: Array.isArray(promoted) ? promoted.length : 0, waitlist: await waitlist(scope.db, eventId), canPromote: true };
  });
}
