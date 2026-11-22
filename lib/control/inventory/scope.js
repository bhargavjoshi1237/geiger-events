import { ApiError } from "../../staff_access/errors.js";
import { requireId } from "../ids.js";
import { must, projectScope } from "../scope.js";

// Inventory and Members open with their sidebar view keys, as the dashboard gates those screens.
export const INVENTORY_PERMISSION = "events.inventory.view";
export const MEMBERS_PERMISSION = "events.memberships.view";

export const inventoryScope = (ctx, projectId) => projectScope(ctx, projectId, INVENTORY_PERMISSION);
export const membersScope = (ctx, projectId) => projectScope(ctx, projectId, MEMBERS_PERMISSION);

// A row of this project; one the user can't read, or from another project, is simply not found.
export async function ownedRow(db, table, id, projectId, { notFound, columns = "*", softDeleted = true } = {}) {
  requireId(id);
  let query = db.from(table).select(columns).eq("id", id).eq("project_id", projectId);
  if (softDeleted) query = query.is("deleted_at", null);
  const row = must(await query.maybeSingle(), `${table}.load`);
  if (!row) throw new ApiError("not_found", 404, notFound);
  return row;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// One ledger row; the database trigger applies it to the item's on_hand.
export async function recordMovement(db, { projectId, itemId, eventId = null, allocationId = null, userId, ...rest }) {
  return must(
    await db
      .from("inventory_movements")
      .insert({
        project_id: projectId,
        item_id: itemId,
        event_id: eventId,
        allocation_id: allocationId,
        kind: rest.kind,
        qty: rest.qty,
        reason: rest.reason || "",
        note: rest.note || "",
        reference: rest.reference || "",
        created_by: userId,
      })
      .select("*")
      .single(),
    "inventory.movement",
  );
}
