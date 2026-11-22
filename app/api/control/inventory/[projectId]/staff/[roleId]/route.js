import { withControl } from "@/lib/control/http";
import { deskRoleView, parseDeskRolePatch } from "@/lib/control/inventory/model";
import { inventoryScope, ownedRow } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

const NOT_FOUND = "Desk role not found.";

async function deskRole(scope, projectId, roleId) {
  const row = await ownedRow(scope.db, "checkin_staff_roles", roleId, projectId, { notFound: NOT_FOUND });
  // Door and kiosk roles belong to Check-in; this screen only manages the issuing desk.
  if (row.type !== "issue") throw new ApiError("not_found", 404, NOT_FOUND);
  return row;
}

// PATCH { name?, active?, canIssue?, canReturn?, canOverride?, regenerate? }
export async function PATCH(request, { params }) {
  const { projectId, roleId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const body = await readJson(request);
    const row = await deskRole(scope, projectId, roleId);
    const patch = parseDeskRolePatch(body, row);
    const saved = must(await scope.db.from("checkin_staff_roles").update(patch).eq("id", roleId).select("*").single(), "inventory.updateStaff");
    return { role: deskRoleView(saved) };
  });
}

export async function DELETE(request, { params }) {
  const { projectId, roleId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    await deskRole(scope, projectId, roleId);
    must(await scope.db.from("checkin_staff_roles").update({ deleted_at: new Date().toISOString() }).eq("id", roleId), "inventory.deleteStaff");
    return { deleted: true };
  });
}
