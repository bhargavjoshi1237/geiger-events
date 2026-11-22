import { withControl } from "@/lib/control/http";
import { eventsById, moneyAccess, ordersById } from "@/lib/control/money/queries";
import { DISPUTE_STATUSES, disputeView, pickFilter } from "@/lib/control/money/views";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { must, projectScope } from "@/lib/control/scope";

// GET ?status= — chargebacks and payment disputes logged against this project's orders.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.orders);
    const status = pickFilter(new URL(request.url).searchParams.get("status"), DISPUTE_STATUSES);
    let query = scope.db.from("order_disputes").select("*").eq("project_id", projectId).is("deleted_at", null);
    if (status) query = query.eq("status", status);
    const [rows, can] = await Promise.all([
      query.order("created_at", { ascending: false }).limit(200).then((res) => must(res, "money.disputes")),
      moneyAccess(scope, ctx.principal.id),
    ]);
    const [orders, events] = await Promise.all([ordersById(scope.db, rows.map((r) => r.order_id)), eventsById(scope.db, rows.map((r) => r.event_id))]);
    return { disputes: rows.map((r) => disputeView(r, orders.get(r.order_id), events.get(r.event_id))), can: { decide: can.refund } };
  });
}
