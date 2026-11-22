import { ROLE_TYPES, parseRole, roleView } from "@/lib/control/checkin_ops/roles";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { must, projectScope, readJson } from "@/lib/control/scope";

const named = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((item) => item && item.id && item.name)
    .map((item) => ({ id: String(item.id), name: String(item.name) }));

// GET — door and kiosk roles, plus the gates and zones (Multi-gate & Zones) a role can be limited to.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.checkIn);
    const [rows, settings] = await Promise.all([
      scope.db
        .from("checkin_staff_roles")
        .select("*")
        .eq("project_id", projectId)
        .in("type", ROLE_TYPES)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .then((r) => must(r, "roles.list")),
      scope.db
        .from("checkin_settings")
        .select("multiGate:config->multiGate")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .maybeSingle()
        .then((r) => must(r, "roles.areas")),
    ]);
    return { roles: rows.map(roleView), gates: named(settings?.multiGate?.gates), zones: named(settings?.multiGate?.zones) };
  });
}

// POST { name, type?, accessCode?, permissions? } — a new role with a generated code unless one is given.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, CONTROL_CAPABILITIES.checkIn);
    const row = parseRole(await readJson(request));
    const created = must(
      await scope.db
        .from("checkin_staff_roles")
        .insert({ ...row, active: row.active ?? true, project_id: projectId, created_by: ctx.principal.id })
        .select("*")
        .single(),
      "roles.create",
    );
    return { role: roleView(created) };
  });
}
