import { controlBoundary, userDb } from "@/lib/control/boundary";
import { PUBLIC_COLUMNS, parseEventPatch } from "@/lib/control/event_fields";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES, loadControlEvent } from "@/lib/control/profile";
import { countRows, loadDoorCounts } from "@/lib/control/queries";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// One event, its editable details, what this team member may do at it, and the numbers the hub shows.
async function eventHub(ctx, eventId) {
  const boundary = await controlBoundary();
  const hub = await loadControlEvent({ principal: ctx.principal, eventId, boundary });
  const db = userDb(ctx.token);
  const [door, pending] = await Promise.all([
    loadDoorCounts(db, eventId),
    countRows(db, "registrations", (q) => q.eq("event_id", eventId).is("deleted_at", null).eq("status", "Pending")),
  ]);
  return { ...hub, counts: { guests: door.expected, pending, checkedIn: door.admitted } };
}

export async function GET(request, { params }) {
  const { eventId } = await params;
  return withControl(request, (ctx) => eventHub(ctx, eventId));
}

// Details need "Edit an event"; status, visibility and Event Wall listing also need "Publish an event" because they change what the public sees.
export async function PATCH(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const { row, publicChange } = parseEventPatch(await readJson(request));
    const publicOnly = publicChange && Object.keys(row).every((column) => PUBLIC_COLUMNS.includes(column));
    const primary = publicOnly ? CONTROL_CAPABILITIES.publish : CONTROL_CAPABILITIES.edit;
    const scope = await eventScope(ctx, eventId, primary, { also: publicChange ? [CONTROL_CAPABILITIES.publish] : [] });
    if (publicChange && !scope.allowed[CONTROL_CAPABILITIES.publish]) {
      throw new ApiError("forbidden", 403, "Your role can't change who can see this event.");
    }
    const updated = must(
      await scope.db.from("events").update(row).eq("id", eventId).is("deleted_at", null).select("id").maybeSingle(),
      "event.update",
    );
    if (!updated) throw new ApiError("not_found", 404, "Event not found.");
    return eventHub(ctx, eventId);
  });
}

// Soft delete, as the dashboard does; the event drops out of every list but its orders and guests are kept.
export async function DELETE(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.delete);
    const deleted = must(
      await scope.db
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", eventId)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle(),
      "event.delete",
    );
    if (!deleted) throw new ApiError("not_found", 404, "Event not found.");
    return { deleted: true };
  });
}
