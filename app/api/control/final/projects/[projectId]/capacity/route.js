import { capacityRows, capacityStats, EVENT_COLUMNS } from "@/lib/control/final/capacity";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { must, projectPermissions } from "@/lib/control/scope";
import { selectAll } from "@/lib/supabase/select_all";
import { ApiError } from "@/lib/staff_access/errors";

const REGISTRATIONS = "events.registrations.view";

// GET — every event's fill against capacity plus buffer, and whether this role may change them.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [REGISTRATIONS, CONTROL_CAPABILITIES.edit]);
    if (!access.allowed(REGISTRATIONS)) throw new ApiError("forbidden", 403, "You don't have permission to do that.");
    const [events, registrations] = await Promise.all([
      selectAll(() => access.db.from("events").select(EVENT_COLUMNS).eq("project_id", projectId).is("deleted_at", null).order("id")),
      selectAll(() =>
        access.db.from("registrations").select("event_id,status,party_size").eq("project_id", projectId).is("deleted_at", null).order("id"),
      ),
    ]);
    const rows = capacityRows(must(events, "capacity.events"), must(registrations, "capacity.registrations"));
    return { events: rows, stats: capacityStats(rows), canEdit: access.allowed(CONTROL_CAPABILITIES.edit) };
  });
}
