import { withControl } from "@/lib/control/http";
import { deskRoleView, newDeskRole } from "@/lib/control/inventory/model";
import { inventoryScope } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";

// Issuing-desk staff are check-in staff roles of type "issue": their codes open /issue and nothing else.

export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const rows = must(
      await scope.db
        .from("checkin_staff_roles")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", "issue")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      "inventory.staff",
    );
    return { roles: rows.map(deskRoleView) };
  });
}

// POST { name } — a new desk role with a fresh six-digit code that can issue (undo and override start off).
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await inventoryScope(ctx, projectId);
    const row = newDeskRole(await readJson(request), projectId, ctx.principal.id);
    const created = must(await scope.db.from("checkin_staff_roles").insert(row).select("*").single(), "inventory.createStaff");
    return { role: deskRoleView(created) };
  });
}
