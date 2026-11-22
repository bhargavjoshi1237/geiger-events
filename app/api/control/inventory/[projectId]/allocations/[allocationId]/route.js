import { withControl } from "@/lib/control/http";
import { ALLOCATION_STATUSES, allocationView } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

const NOT_FOUND = "Allocation not found.";

// PATCH { status } — Planned, Reserved, Issued or Closed, as the dashboard's row menu sets it.
export async function PATCH(request, { params }) {
  const { projectId, allocationId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const { status } = await readJson(request);
    if (!ALLOCATION_STATUSES.includes(status)) throw new ApiError("invalid_input", 400, "Pick one of the statuses.", { status: "Unknown status." });
    await ownedRow(scope.db, "inventory_allocations", allocationId, projectId, { notFound: NOT_FOUND });
    const saved = must(await scope.db.from("inventory_allocations").update({ status }).eq("id", allocationId).select("*").single(), "inventory.allocationStatus");
    return { allocation: allocationView(saved) };
  });
}

// DELETE — removes the allocation; stock already issued stays issued, as on the dashboard.
export async function DELETE(request, { params }) {
  const { projectId, allocationId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    await ownedRow(scope.db, "inventory_allocations", allocationId, projectId, { notFound: NOT_FOUND });
    must(await scope.db.from("inventory_allocations").update({ deleted_at: new Date().toISOString() }).eq("id", allocationId), "inventory.deleteAllocation");
    return { deleted: true };
  });
}
