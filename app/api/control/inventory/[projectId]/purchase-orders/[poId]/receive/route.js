import { withControl } from "@/lib/control/http";
import { poRef, purchaseOrderView, receivePlan } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow, recordMovement, today } from "@/lib/control/inventory/scope";
import { must } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST — receives every outstanding line, like receivePurchaseOrder. The order is claimed first (only if unchanged since it
// was read), so a retry or double tap can't put the same stock on the append-only ledger twice.
export async function POST(request, { params }) {
  const { projectId, poId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const row = await ownedRow(scope.db, "inventory_purchase_orders", poId, projectId, { notFound: "Purchase order not found." });
    const plan = receivePlan(row, today());
    const [claimed] = must(
      await scope.db.from("inventory_purchase_orders").update(plan.patch).eq("id", poId).eq("updated_at", row.updated_at).select("*"),
      "inventory.poReceived",
    ) || [];
    if (!claimed) throw new ApiError("conflict", 409, "This purchase order just changed. Reload it and try again.");
    try {
      for (const line of plan.movements) {
        await recordMovement(scope.db, {
          projectId,
          itemId: line.itemId,
          kind: "receive",
          qty: line.qty,
          reason: "Purchase order received",
          reference: poRef(row),
          userId: ctx.principal.id,
        });
      }
    } catch (error) {
      // Put the order back so it can be received again; movements already written stay on the ledger and show in its history.
      await scope.db.from("inventory_purchase_orders").update({ lines: row.lines, status: row.status, received_at: row.received_at }).eq("id", poId);
      throw error;
    }
    return { order: purchaseOrderView(claimed), received: plan.movements.reduce((sum, m) => sum + m.qty, 0) };
  });
}
