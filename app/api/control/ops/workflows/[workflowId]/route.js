import { withControl } from "@/lib/control/http";
import { OPS_PERMISSIONS, ownedScope } from "@/lib/control/ops/scope";
import { parseWorkflowStatus, workflowView } from "@/lib/control/ops/views";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// PATCH { status: "Active" | "Paused" } — the dashboard's on/off switch; building steps stays on the canvas.
export async function PATCH(request, { params }) {
  const { workflowId } = await params;
  return withControl(request, async (ctx) => {
    const status = parseWorkflowStatus(await readJson(request));
    const scope = await ownedScope(ctx, { table: "workflows", id: workflowId, permission: OPS_PERMISSIONS.workflows, notFound: "Workflow not found." });
    const updated = must(
      await scope.db.from("workflows").update({ status }).eq("id", workflowId).is("deleted_at", null).select("*").maybeSingle(),
      "workflows.status",
    );
    if (!updated) throw new ApiError("not_found", 404, "Workflow not found.");
    return { workflow: workflowView(updated) };
  });
}
