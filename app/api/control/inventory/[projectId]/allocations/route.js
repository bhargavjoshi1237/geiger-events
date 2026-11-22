import { withControl } from "@/lib/control/http";
import { allocationView, itemLabel, itemView, parseAllocation } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

function ticketsOf(event) {
  return (Array.isArray(event?.tickets) ? event.tickets : []).filter((t) => t?.id).map((t) => ({ id: String(t.id), name: String(t.name || "Ticket") }));
}

// GET ?eventId= — allocations with their item and event names, plus the events and stocked items a new one can use.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const eventId = new URL(request.url).searchParams.get("eventId");
    let query = scope.db.from("inventory_allocations").select("*").eq("project_id", projectId).is("deleted_at", null);
    if (eventId && /^[0-9a-f-]{36}$/i.test(eventId)) query = query.eq("event_id", eventId);
    const [allocations, items, events] = await Promise.all([
      query.order("created_at", { ascending: false }).then((r) => must(r, "inventory.allocations")),
      scope.db.from("inventory_items").select("*").eq("project_id", projectId).is("deleted_at", null).then((r) => must(r, "inventory.allocationItems")),
      scope.db
        .from("events")
        .select("id,name,event_date,tickets:metadata->tickets")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("event_date", { ascending: false, nullsFirst: true })
        .limit(200)
        .then((r) => must(r, "inventory.allocationEvents")),
    ]);
    const itemsById = new Map(items.map((i) => [i.id, itemView(i)]));
    const parents = new Set(items.map((i) => i.parent_id).filter(Boolean));
    const eventNames = new Map(events.map((e) => [e.id, e.name]));
    return {
      allocations: allocations.map((a) => {
        const item = itemsById.get(a.item_id);
        return { ...allocationView(a), itemLabel: item?.label || "Deleted item", onHand: item?.onHand ?? 0, eventName: eventNames.get(a.event_id) || "Event" };
      }),
      items: items.filter((i) => !parents.has(i.id)).map(itemView),
      events: events.map((e) => ({ id: e.id, name: e.name, date: e.event_date, tickets: ticketsOf(e) })),
    };
  });
}

// POST { eventId, itemId, plannedQty, issuance: internal|all|ticket, ticketIds?, qtyPerAttendee?, status? }
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const body = await readJson(request);
    const event = body.eventId
      ? await ownedRow(scope.db, "events", body.eventId, projectId, { notFound: "That event no longer exists.", columns: "id,tickets:metadata->tickets" })
      : null;
    const row = parseAllocation(body, ticketsOf(event));
    const item = await ownedRow(scope.db, "inventory_items", row.item_id, projectId, { notFound: "That item no longer exists." });
    const variants = must(await scope.db.from("inventory_items").select("id").eq("parent_id", item.id).is("deleted_at", null).limit(1), "inventory.allocationVariants");
    if (variants.length) throw new ApiError("invalid_input", 400, "Allocate one of this item's variants.", { itemId: "Pick a variant." });
    const created = must(
      await scope.db
        .from("inventory_allocations")
        .insert({ ...row, project_id: projectId, issued_qty: 0, created_by: ctx.principal.id })
        .select("*")
        .single(),
      "inventory.createAllocation",
    );
    return { allocation: { ...allocationView(created), itemLabel: itemLabel(itemView(item)), onHand: Number(item.on_hand) || 0, eventName: "" } };
  });
}
