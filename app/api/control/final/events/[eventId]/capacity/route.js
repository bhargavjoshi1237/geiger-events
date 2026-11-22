import { parseCapacityPatch } from "@/lib/control/final/capacity";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

const REGISTRATIONS = "events.registrations.view";

// PATCH { capacity?, buffer? } — capacity on the event row, the overbook buffer in its metadata, as Capacity Limits saves them.
export async function PATCH(request, { params }) {
  const { eventId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseCapacityPatch(await readJson(request));
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.edit, { also: [REGISTRATIONS] });
    if (!scope.allowed[REGISTRATIONS]) throw new ApiError("forbidden", 403, "You don't have permission to do that.");
    if ("capacity" in patch) {
      const updated = must(
        await scope.db.from("events").update({ capacity: patch.capacity }).eq("id", eventId).is("deleted_at", null).select("id").maybeSingle(),
        "capacity.update",
      );
      if (!updated) throw new ApiError("not_found", 404, "Event not found.");
    }
    if ("buffer" in patch) {
      must(await scope.db.rpc("event_merge_meta", { p_id: eventId, p_patch: { capacityBuffer: patch.buffer } }), "capacity.buffer");
    }
    return { saved: true, ...patch };
  });
}
