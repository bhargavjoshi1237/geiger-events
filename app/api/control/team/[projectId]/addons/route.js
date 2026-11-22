import { INSTALLED_ADDONS } from "@/addons";
import { withControl } from "@/lib/control/http";
import { must, projectPermissions, readJson } from "@/lib/control/scope";
import { TEAM_KEYS, requireAllowed } from "@/lib/control/team/keys";
import { ApiError } from "@/lib/staff_access/errors";

function addonView(addon, row) {
  return {
    id: addon.id,
    name: addon.name,
    description: addon.description ?? "",
    category: addon.category ?? "",
    version: addon.version ?? "",
    features: Array.isArray(addon.features) ? addon.features : [],
    enabled: Boolean(row?.enabled),
  };
}

async function rowsFor(db, projectId) {
  return must(await db.from("project_addons").select("addon_id,enabled").eq("project_id", projectId).is("deleted_at", null), "team.addons");
}

// GET — every installed add-on and whether this project has it on.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.view, TEAM_KEYS.manage]);
    requireAllowed(access, TEAM_KEYS.view, "Your role can't see add-ons.");
    const byId = new Map((await rowsFor(access.db, projectId)).map((r) => [r.addon_id, r]));
    return { addons: INSTALLED_ADDONS.map((a) => addonView(a, byId.get(a.id))), canManage: access.allowed(TEAM_KEYS.manage) };
  });
}

// PATCH { addonId, enabled } — the same single live row per (project, add-on) the dashboard upserts.
export async function PATCH(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { addonId, enabled } = await readJson(request);
    const addon = INSTALLED_ADDONS.find((a) => a.id === addonId);
    if (!addon) throw new ApiError("not_found", 404, "That add-on isn't installed.");
    if (typeof enabled !== "boolean") throw new ApiError("invalid_input", 400, "Turn it on or off.");
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.manage]);
    requireAllowed(access, TEAM_KEYS.manage, "Your role can't change add-ons.");
    const row = must(
      await access.db
        .from("project_addons")
        .upsert({ project_id: projectId, addon_id: addon.id, enabled, created_by: ctx.principal.id }, { onConflict: "project_id,addon_id" })
        .select("addon_id,enabled")
        .single(),
      "team.addonSave",
    );
    return { addon: addonView(addon, row) };
  });
}
