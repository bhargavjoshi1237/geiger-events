import { withControl } from "@/lib/control/http";
import { parseSupplier, supplierView } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";

const NOT_FOUND = "Supplier not found.";

export async function PATCH(request, { params }) {
  const { projectId, supplierId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const patch = parseSupplier(await readJson(request));
    await ownedRow(scope.db, "inventory_suppliers", supplierId, projectId, { notFound: NOT_FOUND });
    const saved = must(await scope.db.from("inventory_suppliers").update(patch).eq("id", supplierId).select("*").single(), "inventory.updateSupplier");
    return { supplier: supplierView(saved) };
  });
}

// DELETE — soft delete; purchase orders keep their history, as on the dashboard.
export async function DELETE(request, { params }) {
  const { projectId, supplierId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    await ownedRow(scope.db, "inventory_suppliers", supplierId, projectId, { notFound: NOT_FOUND });
    must(await scope.db.from("inventory_suppliers").update({ deleted_at: new Date().toISOString() }).eq("id", supplierId), "inventory.deleteSupplier");
    return { deleted: true };
  });
}
