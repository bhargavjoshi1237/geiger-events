import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { releaseHolds } from "@/lib/control/queries";
import { ORDER_COLUMNS } from "@/lib/control/records";
import { actorOf, must, recordScope } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST — cancels the order and frees its seats and booths. Money doesn't move; refund first when the buyer is owed.
export async function POST(request, { params }) {
  const { orderId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await recordScope(ctx, {
      table: "event_orders",
      id: orderId,
      columns: ORDER_COLUMNS,
      permission: CONTROL_CAPABILITIES.refund,
      notFound: "Order not found.",
    });
    if (scope.row.cancelled_at) throw new ApiError("invalid_state", 409, "This order is already cancelled.");
    must(
      await scope.db.from("event_orders").update({ cancelled_at: new Date().toISOString(), status: "cancelled" }).eq("id", orderId),
      "order.cancel",
    );
    must(
      await scope.db.from("order_events").insert({
        order_id: orderId,
        project_id: scope.projectId,
        type: "cancelled",
        summary: "Order cancelled",
        actor: actorOf(ctx.token),
      }),
      "order.cancelNote",
    );
    await releaseHolds(scope.db, orderId);
    return { cancelled: true };
  });
}
