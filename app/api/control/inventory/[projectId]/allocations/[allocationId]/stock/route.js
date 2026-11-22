import { withControl } from "@/lib/control/http";
import { allocationView, parseIssueOrReturn } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow, recordMovement } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST { mode: issue|return, qty } — like issueAllocation. The issued count moves first, and only from the value it was read
// at, so two taps can't both issue against the same stock; the ledger movement follows.
export async function POST(request, { params }) {
  const { projectId, allocationId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const body = await readJson(request);
    const allocation = await ownedRow(scope.db, "inventory_allocations", allocationId, projectId, { notFound: "Allocation not found." });
    const item = await ownedRow(scope.db, "inventory_items", allocation.item_id, projectId, { notFound: "This allocation's item was deleted." });
    const plan = parseIssueOrReturn(body, allocation, item);
    const [claimed] = must(
      await scope.db
        .from("inventory_allocations")
        .update(plan.patch)
        .eq("id", allocation.id)
        .eq("issued_qty", allocation.issued_qty ?? 0)
        .select("*"),
      "inventory.allocationIssued",
    ) || [];
    if (!claimed) throw new ApiError("conflict", 409, "This allocation just changed. Reload it and try again.");
    try {
      await recordMovement(scope.db, {
        projectId,
        itemId: allocation.item_id,
        eventId: allocation.event_id,
        allocationId: allocation.id,
        userId: ctx.principal.id,
        ...plan.movement,
      });
    } catch (error) {
      await scope.db
        .from("inventory_allocations")
        .update({ issued_qty: allocation.issued_qty ?? 0, status: allocation.status })
        .eq("id", allocation.id)
        .eq("issued_qty", claimed.issued_qty);
      throw error;
    }
    return { allocation: allocationView(claimed), mode: plan.mode };
  });
}
