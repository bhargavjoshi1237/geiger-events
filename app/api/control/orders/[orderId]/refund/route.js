import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { releaseHolds } from "@/lib/control/queries";
import { ORDER_COLUMNS, parseRefund } from "@/lib/control/records";
import { actorOf, must, readJson, recordScope } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST { amount, reasonCode?, reason? } — records a refund through the same atomic RPC as the dashboard (record-only; no card is charged back here).
export async function POST(request, { params }) {
  const { orderId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const scope = await recordScope(ctx, {
      table: "event_orders",
      id: orderId,
      columns: ORDER_COLUMNS,
      permission: CONTROL_CAPABILITIES.refund,
      notFound: "Order not found.",
    });
    if (scope.row.cancelled_at) throw new ApiError("invalid_state", 409, "This order is cancelled.");
    const refund = parseRefund(body, scope.row);
    const data = must(
      await scope.db.rpc("issue_order_refund", {
        p_order_id: orderId,
        p_amount: refund.amount,
        p_reason: refund.reason,
        p_reason_code: refund.reasonCode,
        p_method: "original",
        p_actor: actorOf(ctx.token),
      }),
      "order.refund",
    );
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) throw new ApiError("invalid_state", 409, "That refund couldn't be recorded. Check the amount left on the order.");
    // Only a full refund returns seats and booths to the pool, as on the dashboard.
    if (Number(result.order_total) > 0 && Number(result.refunded_total) >= Number(result.order_total)) await releaseHolds(scope.db, orderId);
    return { refunded: refund.amount };
  });
}
