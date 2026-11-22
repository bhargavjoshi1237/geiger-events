import { withControl } from "@/lib/control/http";
import { eventsById, moneyAccess } from "@/lib/control/money/queries";
import { REFUND_REQUEST_STATUSES, pickFilter, refundRequestView } from "@/lib/control/money/views";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { must, projectScope } from "@/lib/control/scope";

// GET ?status= — buyers' refund requests from the members portal, newest first.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.orders);
    const status = pickFilter(new URL(request.url).searchParams.get("status"), REFUND_REQUEST_STATUSES);
    let query = scope.db.from("refund_requests").select("*").eq("project_id", projectId).is("deleted_at", null);
    if (status) query = query.eq("status", status);
    const [rows, can] = await Promise.all([
      query.order("created_at", { ascending: false }).limit(200).then((res) => must(res, "money.refundRequests")),
      moneyAccess(scope, ctx.principal.id),
    ]);
    const events = await eventsById(scope.db, rows.map((r) => r.event_id));
    return { requests: rows.map((r) => refundRequestView(r, events.get(r.event_id))), can: { decide: can.refund } };
  });
}
