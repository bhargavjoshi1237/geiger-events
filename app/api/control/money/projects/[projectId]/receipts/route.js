import { withControl } from "@/lib/control/http";
import { eventsById } from "@/lib/control/money/queries";
import { PAGE } from "@/lib/control/money/views";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { ORDER_COLUMNS, orderView, parseCursor, searchTerm } from "@/lib/control/records";
import { must, projectScope } from "@/lib/control/scope";

// GET ?q=&before= — one receipt per live order, newest first. View-only: the dashboard has no receipt-sending route either.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.orders);
    const query = new URL(request.url).searchParams;
    const term = searchTerm(query.get("q"));
    const before = parseCursor(query.get("before"));
    let q = scope.db.from("event_orders").select(ORDER_COLUMNS).eq("project_id", projectId).is("cancelled_at", null);
    if (term) q = q.or(`buyer_name.ilike.%${term}%,buyer_email.ilike.%${term}%,ticket_name.ilike.%${term}%`);
    if (before) q = q.lt("created_at", before);
    const rows = must(await q.order("created_at", { ascending: false }).limit(PAGE), "money.receipts");
    const events = await eventsById(scope.db, rows.map((r) => r.event_id));
    return {
      receipts: rows.map((r) => orderView(r, events.get(r.event_id)?.name || "", events.get(r.event_id)?.currency)),
      nextBefore: rows.length === PAGE ? rows[rows.length - 1].created_at : null,
    };
  });
}
