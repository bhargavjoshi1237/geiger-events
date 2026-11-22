import { withControl } from "@/lib/control/http";
import { enquiryKind } from "@/lib/control/money/enquiries";
import { eventsById } from "@/lib/control/money/queries";
import { ENQUIRY_STATUSES, pickFilter } from "@/lib/control/money/views";
import { must, projectScope } from "@/lib/control/scope";

// GET ?status= — package or sponsor enquiries across the project's events, newest first.
export async function GET(request, { params }) {
  const { projectId, kind } = await params;
  return withControl(request, async (ctx) => {
    const spec = enquiryKind(kind);
    const scope = await projectScope(ctx, projectId, spec.permission);
    const status = pickFilter(new URL(request.url).searchParams.get("status"), ENQUIRY_STATUSES);
    let query = scope.db.from(spec.table).select("*").eq("project_id", projectId).is("deleted_at", null);
    if (status) query = query.eq("status", status);
    const rows = must(await query.order("created_at", { ascending: false }).limit(200), `money.${kind}`);
    const events = await eventsById(scope.db, rows.map((r) => r.event_id));
    return { enquiries: rows.map((r) => spec.view(r, events.get(r.event_id))) };
  });
}
