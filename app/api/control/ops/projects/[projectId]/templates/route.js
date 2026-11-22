import { withControl } from "@/lib/control/http";
import { OPS_PERMISSIONS } from "@/lib/control/ops/scope";
import { templateView } from "@/lib/control/ops/views";
import { must, projectPermissions } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// GET — the project's event templates, newest first, and whether this role may create events from them.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [OPS_PERMISSIONS.events, OPS_PERMISSIONS.edit]);
    if (!access.allowed(OPS_PERMISSIONS.events)) throw new ApiError("forbidden", 403, "You don't have permission to do that.");
    const rows = must(
      await access.db
        .from("event_templates")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      "templates.list",
    );
    return { templates: rows.map(templateView), canUse: access.allowed(OPS_PERMISSIONS.edit) };
  });
}
