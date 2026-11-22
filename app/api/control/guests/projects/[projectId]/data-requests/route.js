import { GUESTS } from "@/lib/control/guests/access";
import { dataRequestView } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, projectScope } from "@/lib/control/scope";

// GET — the privacy request queue (export, erasure, rectification), newest first.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, GUESTS);
    const rows = must(
      await scope.db.from("data_requests").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
      "dataRequests.list",
    );
    return { requests: rows.map(dataRequestView) };
  });
}
