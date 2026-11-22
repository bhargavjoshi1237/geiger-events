import { userDb } from "@/lib/control/boundary";
import { ROLE_TYPES, parseRole, roleView } from "@/lib/control/checkin_ops/roles";
import { requireId, withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { must, projectScope, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// A role the user can read (RLS hides other projects), authorised against its own project.
async function roleScope(ctx, roleId) {
  requireId(roleId);
  const row = must(
    await userDb(ctx.token).from("checkin_staff_roles").select("*").eq("id", roleId).is("deleted_at", null).maybeSingle(),
    "roles.load",
  );
  if (!row?.project_id || !ROLE_TYPES.includes(row.type || "staff")) throw new ApiError("not_found", 404, "Role not found.");
  return { ...(await projectScope(ctx, row.project_id, CONTROL_CAPABILITIES.checkIn)), row };
}

// PATCH { name?, type?, accessCode?, active?, permissions? }
export async function PATCH(request, { params }) {
  const { roleId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const scope = await roleScope(ctx, roleId);
    const patch = parseRole(body, { current: scope.row });
    const updated = must(
      await scope.db.from("checkin_staff_roles").update(patch).eq("id", roleId).is("deleted_at", null).select("*").maybeSingle(),
      "roles.update",
    );
    if (!updated) throw new ApiError("not_found", 404, "Role not found.");
    return { role: roleView(updated) };
  });
}

// Soft delete: the code stops opening the scanner at once.
export async function DELETE(request, { params }) {
  const { roleId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await roleScope(ctx, roleId);
    must(await scope.db.from("checkin_staff_roles").update({ deleted_at: new Date().toISOString() }).eq("id", roleId), "roles.delete");
    return { deleted: true };
  });
}
