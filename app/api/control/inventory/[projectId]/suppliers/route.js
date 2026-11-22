import { withControl } from "@/lib/control/http";
import { parseSupplier, purchaseOrderView, supplierView } from "@/lib/control/inventory/model";
import { inventoryScope } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";

// GET — suppliers and purchase orders together, as the dashboard's Suppliers & Purchase Orders screen shows them.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const [suppliers, orders] = await Promise.all([
      scope.db.from("inventory_suppliers").select("*").eq("project_id", projectId).is("deleted_at", null).order("name").then((r) => must(r, "inventory.suppliers")),
      scope.db
        .from("inventory_purchase_orders")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .then((r) => must(r, "inventory.purchaseOrders")),
    ]);
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    return {
      suppliers: suppliers.map(supplierView),
      orders: orders.map((o) => ({ ...purchaseOrderView(o), supplierName: names.get(o.supplier_id) || "" })),
    };
  });
}

// POST { name, contactName?, email?, phone?, website?, leadTimeDays?, notes? }
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const row = parseSupplier(await readJson(request), { create: true });
    const created = must(
      await scope.db.from("inventory_suppliers").insert({ ...row, project_id: projectId, config: {}, created_by: ctx.principal.id }).select("*").single(),
      "inventory.createSupplier",
    );
    return { supplier: supplierView(created) };
  });
}
