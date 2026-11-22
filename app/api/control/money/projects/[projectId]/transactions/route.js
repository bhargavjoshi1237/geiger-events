import { withControl } from "@/lib/control/http";
import { eventsById, ordersById } from "@/lib/control/money/queries";
import { LEDGER_TYPES, PAGE, chargeLine, mergeLedger, pickFilter, refundLine } from "@/lib/control/money/views";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { parseCursor, searchTerm } from "@/lib/control/records";
import { must, projectScope } from "@/lib/control/scope";

const CHARGE_COLUMNS = "id,event_id,buyer_name,buyer_email,ticket_name,total,stripe_payment_intent_id,created_at";

// GET ?type=all|charge|refund&q=&before= — every charge and refund merged into one ledger, as on the dashboard.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.orders);
    const query = new URL(request.url).searchParams;
    const type = pickFilter(query.get("type"), LEDGER_TYPES) || "all";
    const term = searchTerm(query.get("q"));
    const before = parseCursor(query.get("before"));
    const match = `buyer_name.ilike.%${term}%,buyer_email.ilike.%${term}%,ticket_name.ilike.%${term}%`;

    const charges = async () => {
      let q = scope.db.from("event_orders").select(CHARGE_COLUMNS).eq("project_id", projectId);
      if (term) q = q.or(match);
      if (before) q = q.lt("created_at", before);
      return must(await q.order("created_at", { ascending: false }).limit(PAGE), "money.charges");
    };
    const refunds = async () => {
      let q = scope.db.from("order_refunds").select("id,order_id,event_id,amount,method,created_at").eq("project_id", projectId).is("deleted_at", null);
      // A search narrows refunds to the orders whose buyer or ticket matches.
      if (term) {
        const ids = must(await scope.db.from("event_orders").select("id").eq("project_id", projectId).or(match).limit(500), "money.refundMatch").map((o) => o.id);
        if (!ids.length) return [];
        q = q.in("order_id", ids);
      }
      if (before) q = q.lt("created_at", before);
      return must(await q.order("created_at", { ascending: false }).limit(PAGE), "money.refunds");
    };

    const [chargeRows, refundRows] = await Promise.all([type === "refund" ? [] : charges(), type === "charge" ? [] : refunds()]);
    const orders = await ordersById(scope.db, refundRows.map((r) => r.order_id));
    const events = await eventsById(scope.db, [
      ...chargeRows.map((c) => c.event_id),
      ...refundRows.map((r) => r.event_id || orders.get(r.order_id)?.event_id),
    ]);
    const page = mergeLedger(
      chargeRows.map((c) => chargeLine(c, events.get(c.event_id))),
      refundRows.map((r) => {
        const order = orders.get(r.order_id);
        return refundLine(r, order, events.get(r.event_id || order?.event_id));
      }),
    );
    return { lines: page.items, nextBefore: page.nextBefore };
  });
}
