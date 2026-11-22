import { withControl } from "@/lib/control/http";
import { requireId } from "@/lib/control/ids";
import { OPS_PERMISSIONS, ownedScope } from "@/lib/control/ops/scope";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST { eventId, add } — puts an event in this series or takes it out, the same series_id write the dashboard makes.
export async function POST(request, { params }) {
  const { seriesId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    if (typeof body.add !== "boolean") throw new ApiError("invalid_input", 400, "Say whether to add or remove the event.");
    const eventId = requireId(body.eventId);
    const series = await ownedScope(ctx, { table: "event_series", id: seriesId, permission: OPS_PERMISSIONS.events, notFound: "Series not found." });
    const event = await eventScope(ctx, eventId, OPS_PERMISSIONS.edit);
    if (event.projectId !== series.projectId) throw new ApiError("not_found", 404, "Event not found.");
    const current = must(await event.db.from("events").select("series_id").eq("id", eventId).maybeSingle(), "series.event");
    if (body.add && current?.series_id && current.series_id !== seriesId) {
      throw new ApiError("invalid_state", 409, "That event already belongs to another series.");
    }
    if (!body.add && current?.series_id !== seriesId) throw new ApiError("invalid_state", 409, "That event isn't in this series.");
    must(
      await event.db.from("events").update({ series_id: body.add ? seriesId : null }).eq("id", eventId).is("deleted_at", null),
      "series.setEvent",
    );
    return { ok: true };
  });
}
