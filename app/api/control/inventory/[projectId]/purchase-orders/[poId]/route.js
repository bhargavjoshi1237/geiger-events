import { withControl } from "@/lib/control/http";
import { parsePoStatus, purchaseOrderView } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow, today } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";

const NOT_FOUND = "Purchase order not found.";

// PATCH { status: Draft|Ordered|Cancelled } — marking it Ordered stamps the order date once.
export async function PATCH(request, { params }) {
  const { projectId, poId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const body = await readJson(request);
    const row = await ownedRow(scope.db, "inventory_purchase_orders", poId, projectId, { notFound: NOT_FOUND });
    const patch = parsePoStatus(body, row, today());
    const saved = must(await scope.db.from("inventory_purchase_orders").update(patch).eq("id", poId).select("*").single(), "inventory.poStatus");
    return { order: purchaseOrderView(saved) };
  });
}

export async function DELETE(request, { params }) {
  const { projectId, poId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    await ownedRow(scope.db, "inventory_purchase_orders", poId, projectId, { notFound: NOT_FOUND });
    must(await scope.db.from("inventory_purchase_orders").update({ deleted_at: new Date().toISOString() }).eq("id", poId), "inventory.deletePo");
    return { deleted: true };
  });
}
