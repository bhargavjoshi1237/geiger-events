import { withControl } from "@/lib/control/http";
import { allocationView, itemView, movementView, parseItemPatch } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";

const NOT_FOUND = "Item not found.";

// GET — one item with its variants, latest movements and where it's allocated.
export async function GET(request, { params }) {
  const { projectId, itemId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const row = await ownedRow(scope.db, "inventory_items", itemId, projectId, { notFound: NOT_FOUND });
    const [variants, movements, allocations] = await Promise.all([
      scope.db.from("inventory_items").select("*").eq("parent_id", itemId).is("deleted_at", null).order("created_at").then((r) => must(r, "inventory.variants")),
      scope.db
        .from("inventory_movements")
        .select("*")
        .eq("project_id", projectId)
        .eq("item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(30)
        .then((r) => must(r, "inventory.itemMovements")),
      scope.db
        .from("inventory_allocations")
        .select("*")
        .eq("project_id", projectId)
        .eq("item_id", itemId)
        .is("deleted_at", null)
        .then((r) => must(r, "inventory.itemAllocations")),
    ]);
    const eventIds = [...new Set(allocations.map((a) => a.event_id).filter(Boolean))];
    const events = eventIds.length ? must(await scope.db.from("events").select("id,name").in("id", eventIds), "inventory.itemEvents") : [];
    const names = new Map(events.map((e) => [e.id, e.name]));
    return {
      item: itemView(row),
      variants: variants.map(itemView),
      movements: movements.map(movementView),
      allocations: allocations.map((a) => ({ ...allocationView(a), eventName: names.get(a.event_id) || "Event" })),
    };
  });
}

// PATCH — the drawer's fields; stock only ever changes through a movement.
export async function PATCH(request, { params }) {
  const { projectId, itemId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const patch = parseItemPatch(await readJson(request));
    await ownedRow(scope.db, "inventory_items", itemId, projectId, { notFound: NOT_FOUND });
    const saved = must(await scope.db.from("inventory_items").update(patch).eq("id", itemId).select("*").single(), "inventory.updateItem");
    return { item: itemView(saved) };
  });
}

// DELETE — soft-deletes the item and, for a parent, its variants with it.
export async function DELETE(request, { params }) {
  const { projectId, itemId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    await ownedRow(scope.db, "inventory_items", itemId, projectId, { notFound: NOT_FOUND });
    must(
      await scope.db
        .from("inventory_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("project_id", projectId)
        .or(`id.eq.${itemId},parent_id.eq.${itemId}`),
      "inventory.deleteItem",
    );
    return { deleted: true };
  });
}
