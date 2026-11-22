import { withControl } from "@/lib/control/http";
import { itemLabel, itemView, MOVEMENT_KINDS, movementView, parseMovement } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow, recordMovement } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// GET ?kind= — the append-only ledger, newest first, plus the stocked items a new movement can name.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const kind = new URL(request.url).searchParams.get("kind");
    let query = scope.db.from("inventory_movements").select("*").eq("project_id", projectId);
    if (MOVEMENT_KINDS.some((k) => k.value === kind)) query = query.eq("kind", kind);
    const [movements, items] = await Promise.all([
      query.order("created_at", { ascending: false }).limit(300).then((r) => must(r, "inventory.movements")),
      scope.db.from("inventory_items").select("*").eq("project_id", projectId).is("deleted_at", null).then((r) => must(r, "inventory.movementItems")),
    ]);
    const labels = new Map(items.map((i) => [i.id, itemLabel(itemView(i))]));
    const parents = new Set(items.map((i) => i.parent_id).filter(Boolean));
    return {
      movements: movements.map((m) => ({ ...movementView(m), itemLabel: labels.get(m.item_id) || "Deleted item" })),
      // Stock lives on leaf items: a parent with variants holds none of its own.
      items: items.filter((i) => !parents.has(i.id)).map(itemView),
      kinds: MOVEMENT_KINDS,
    };
  });
}

// POST { itemId, kind, qty, direction?, reason?, note?, reference? } — the only way stock changes.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const body = await readJson(request);
    if (!body.itemId) throw new ApiError("invalid_input", 400, "Pick an item.", { itemId: "Pick an item." });
    const item = await ownedRow(scope.db, "inventory_items", body.itemId, projectId, { notFound: "That item no longer exists." });
    const variants = must(
      await scope.db.from("inventory_items").select("id").eq("parent_id", item.id).is("deleted_at", null).limit(1),
      "inventory.movementVariants",
    );
    if (variants.length) throw new ApiError("invalid_input", 400, "Record stock against one of this item's variants.", { itemId: "Pick a variant." });
    const movement = parseMovement(body, item);
    const created = await recordMovement(scope.db, { projectId, itemId: item.id, userId: ctx.principal.id, ...movement });
    const reloaded = must(await scope.db.from("inventory_items").select("*").eq("id", item.id).single(), "inventory.reloadItem");
    return { movement: { ...movementView(created), itemLabel: itemLabel(itemView(reloaded)) }, item: itemView(reloaded) };
  });
}
