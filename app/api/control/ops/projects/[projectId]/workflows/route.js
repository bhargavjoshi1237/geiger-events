import { withControl } from "@/lib/control/http";
import { OPS_PERMISSIONS } from "@/lib/control/ops/scope";
import { workflowView } from "@/lib/control/ops/views";
import { must, projectScope } from "@/lib/control/scope";

// GET — the project's workflows, newest first.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, OPS_PERMISSIONS.workflows);
    const rows = must(
      await scope.db.from("workflows").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
      "workflows.list",
    );
    return { workflows: rows.map(workflowView) };
  });
}
