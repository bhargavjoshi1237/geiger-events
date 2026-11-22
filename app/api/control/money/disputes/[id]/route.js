import { withControl } from "@/lib/control/http";
import { eventsById, ordersById } from "@/lib/control/money/queries";
import { disputeView, parseDisputePatch } from "@/lib/control/money/views";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { must, readJson, recordScope } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// PATCH { status?, reason?, evidenceDue?, note? } — move a dispute along; deciding one is a money call, so it needs Refund an order.
export async function PATCH(request, { params }) {
  const { id } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const scope = await recordScope(ctx, {
      table: "order_disputes",
      id,
      columns: "*",
      permission: CONTROL_CAPABILITIES.refund,
      notFound: "Dispute not found.",
    });
    if (scope.row.deleted_at) throw new ApiError("not_found", 404, "Dispute not found.");
    const patch = parseDisputePatch(body, scope.row);
    const row = must(await scope.db.from("order_disputes").update(patch).eq("id", id).select("*").single(), "money.disputeUpdate");
    const [orders, events] = await Promise.all([ordersById(scope.db, [row.order_id]), eventsById(scope.db, [row.event_id])]);
    return { dispute: disputeView(row, orders.get(row.order_id), events.get(row.event_id)) };
  });
}
