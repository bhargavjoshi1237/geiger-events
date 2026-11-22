import { withControl } from "@/lib/control/http";
import { eventsById } from "@/lib/control/money/queries";
import { refundRequestView } from "@/lib/control/money/views";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { releaseHolds } from "@/lib/control/queries";
import { ORDER_COLUMNS, orderView, parseRefund } from "@/lib/control/records";
import { actorOf, must, readJson, recordScope } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST { amount? } — grants a request: records the refund through issue_order_refund (as the Refunds center does) and marks it Refunded.
export async function POST(request, { params }) {
  const { id } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const scope = await recordScope(ctx, {
      table: "refund_requests",
      id,
      columns: "*",
      permission: CONTROL_CAPABILITIES.refund,
      notFound: "Refund request not found.",
    });
    const req = scope.row;
    if (req.deleted_at) throw new ApiError("not_found", 404, "Refund request not found.");
    if (req.status === "Refunded") throw new ApiError("invalid_state", 409, "This request has already been refunded.");
    if (!req.order_id) throw new ApiError("invalid_state", 409, "This request isn't linked to an order, so refund it from the dashboard.");

    const order = must(await scope.db.from("event_orders").select(ORDER_COLUMNS).eq("id", req.order_id).maybeSingle(), "money.requestOrder");
    if (!order) throw new ApiError("not_found", 404, "The order on this request no longer exists.");
    if (order.cancelled_at) throw new ApiError("invalid_state", 409, "This order is cancelled.");
    const left = orderView(order).refundable;
    if (left <= 0) throw new ApiError("invalid_state", 409, "Nothing is left to refund on this order.");

    // Without an amount, refund what was asked for, never more than what's left.
    const asked = body.amount === undefined ? Math.min(Number(req.amount) || left, left) : body.amount;
    const refund = parseRefund({ amount: asked, reasonCode: "requested_by_customer", reason: req.reason || "Refund request" }, order);
    const data = must(
      await scope.db.rpc("issue_order_refund", {
        p_order_id: order.id,
        p_amount: refund.amount,
        p_reason: refund.reason.slice(0, 500),
        p_reason_code: refund.reasonCode,
        p_method: "original",
        p_actor: actorOf(ctx.token),
      }),
      "money.requestRefund",
    );
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) throw new ApiError("invalid_state", 409, "That refund couldn't be recorded. Check the amount left on the order.");
    if (Number(result.order_total) > 0 && Number(result.refunded_total) >= Number(result.order_total)) await releaseHolds(scope.db, order.id);

    const row = must(await scope.db.from("refund_requests").update({ status: "Refunded" }).eq("id", id).select("*").single(), "money.requestDone");
    const events = await eventsById(scope.db, [row.event_id]);
    return { request: refundRequestView(row, events.get(row.event_id)), refunded: refund.amount };
  });
}
