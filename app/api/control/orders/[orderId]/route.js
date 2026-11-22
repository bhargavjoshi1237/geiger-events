import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { ORDER_COLUMNS, orderView, parseOrderPatch, refundView, timelineView } from "@/lib/control/records";
import { actorOf, must, readJson, recordScope } from "@/lib/control/scope";

const orderScope = (ctx, orderId, permission, also = []) =>
  recordScope(ctx, { table: "event_orders", id: orderId, columns: ORDER_COLUMNS, permission, notFound: "Order not found.", also });

// The order, its refunds and timeline, and whether this team member may change it.
async function orderDetail(scope) {
  const { db, row } = scope;
  const [event, refunds, timeline] = await Promise.all([
    db.from("events").select("name,currency:metadata->payments->>currency").eq("id", row.event_id).maybeSingle().then((r) => must(r, "order.event")),
    db.from("order_refunds").select("*").eq("order_id", row.id).is("deleted_at", null).order("created_at", { ascending: false }).then((r) => must(r, "order.refunds")),
    db.from("order_events").select("*").eq("order_id", row.id).order("created_at", { ascending: false }).limit(50).then((r) => must(r, "order.timeline")),
  ]);
  return {
    order: orderView(row, event?.name || "", event?.currency),
    refunds: refunds.map(refundView),
    timeline: timeline.map(timelineView),
    can: {
      refund: Boolean(scope.allowed[CONTROL_CAPABILITIES.refund]),
      checkIn: Boolean(scope.allowed[CONTROL_CAPABILITIES.checkIn]),
    },
  };
}

export async function GET(request, { params }) {
  const { orderId } = await params;
  return withControl(request, async (ctx) =>
    orderDetail(await orderScope(ctx, orderId, CONTROL_CAPABILITIES.orders, [CONTROL_CAPABILITIES.refund, CONTROL_CAPABILITIES.checkIn])),
  );
}

// PATCH { name?, email?, note? } — correct the buyer's details or the private note; money moves only through refund/cancel.
export async function PATCH(request, { params }) {
  const { orderId } = await params;
  return withControl(request, async (ctx) => {
    const { patch, note } = parseOrderPatch(await readJson(request));
    const scope = await orderScope(ctx, orderId, CONTROL_CAPABILITIES.refund, [CONTROL_CAPABILITIES.refund, CONTROL_CAPABILITIES.checkIn]);
    const metadata =
      note === undefined
        ? undefined
        : { ...(must(await scope.db.from("event_orders").select("metadata").eq("id", orderId).single(), "order.meta").metadata || {}), note };
    must(
      await scope.db.from("event_orders").update({ ...patch, ...(metadata ? { metadata } : {}) }).eq("id", orderId),
      "order.update",
    );
    const changed = [patch.buyer_name && "name", patch.buyer_email && "email", note !== undefined && "note"].filter(Boolean);
    must(
      await scope.db.from("order_events").insert({
        order_id: orderId,
        project_id: scope.projectId,
        type: "note",
        summary: `Updated ${changed.join(", ")} from the app`,
        actor: actorOf(ctx.token),
      }),
      "order.timelineNote",
    );
    const reloaded = must(await scope.db.from("event_orders").select(ORDER_COLUMNS).eq("id", orderId).single(), "order.reload");
    return orderDetail({ ...scope, row: reloaded });
  });
}
