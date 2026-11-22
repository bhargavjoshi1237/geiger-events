import { withControl } from "@/lib/control/http";
import { itemTree, itemView, parseItemPatch, parseOpeningStock } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow, recordMovement } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// GET — the catalogue as the dashboard groups it: parents with their variants rolled up.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const rows = must(
      await scope.db.from("inventory_items").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
      "inventory.items",
    );
    return { items: itemTree(rows) };
  });
}

// POST { name, sku?, category?, unitCost?, unitPrice?, reorderPoint?, description?, openingStock?, parentId?, variantLabel? }
// A variant takes its parent's name and category; opening stock is recorded as a "receive" movement, never written as a number.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const body = await readJson(request);
    const parent = body.parentId
      ? await ownedRow(scope.db, "inventory_items", body.parentId, projectId, { notFound: "That item no longer exists." })
      : null;
    if (parent?.parent_id) throw new ApiError("invalid_input", 400, "A variant can't have variants of its own.");
    if (parent && !String(body.variantLabel || "").trim()) throw new ApiError("invalid_input", 400, "Name the variant, e.g. Large.");
    const row = parseItemPatch(parent ? { ...body, name: parent.name, category: parent.category } : body, { create: true });
    const opening = parseOpeningStock(body.openingStock);
    const created = must(
      await scope.db
        .from("inventory_items")
        .insert({
          category: "Merch",
          currency: "USD",
          ...row,
          project_id: projectId,
          parent_id: parent?.id ?? null,
          active: true,
          config: {},
          created_by: ctx.principal.id,
        })
        .select("*")
        .single(),
      "inventory.createItem",
    );
    if (opening > 0) {
      await recordMovement(scope.db, { projectId, itemId: created.id, kind: "receive", qty: opening, reason: "Opening stock", userId: ctx.principal.id });
      const reloaded = must(await scope.db.from("inventory_items").select("*").eq("id", created.id).single(), "inventory.reloadItem");
      return { item: itemView(reloaded) };
    }
    return { item: itemView(created) };
  });
}
