import { withControl } from "@/lib/control/http";
import { requireId } from "@/lib/control/ids";
import { OPS_PERMISSIONS } from "@/lib/control/ops/scope";
import { runView } from "@/lib/control/ops/views";
import { must, projectScope } from "@/lib/control/scope";

// GET ?workflow=&status= — the run history, newest first, as on the dashboard's Run History.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, OPS_PERMISSIONS.workflows);
    const query = new URL(request.url).searchParams;
    let runs = scope.db.from("workflow_runs").select("*").eq("project_id", projectId);
    const workflowId = query.get("workflow");
    if (workflowId) runs = runs.eq("workflow_id", requireId(workflowId));
    const status = query.get("status");
    if (["Success", "Failed", "Running", "Skipped"].includes(status)) runs = runs.eq("status", status);
    const [rows, workflows] = await Promise.all([
      runs.order("started_at", { ascending: false }).limit(200),
      scope.db.from("workflows").select("id,name").eq("project_id", projectId),
    ]);
    const names = new Map(must(workflows, "runs.workflows").map((w) => [w.id, w.name]));
    return { runs: must(rows, "runs.list").map((row) => runView(row, names.get(row.workflow_id) || "")) };
  });
}
