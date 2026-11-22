import { withControl } from "@/lib/control/http";
import { must, projectPermissions, readJson } from "@/lib/control/scope";
import { TEAM_KEYS, requireAllowed } from "@/lib/control/team/keys";
import { parseWallPatch, wallView } from "@/lib/control/team/profiles";
import { ApiError } from "@/lib/staff_access/errors";

// The project's public Event Wall; created on first read with the same default slug the dashboard uses.
async function loadWall(db, projectId) {
  const existing = must(await db.from("event_wall").select("*").eq("project_id", projectId).maybeSingle(), "team.wall");
  if (existing) return existing;
  const created = await db.from("event_wall").insert({ project_id: projectId, slug: `events-${projectId.slice(0, 8)}` }).select("*").single();
  if (!created.error) return created.data;
  return must(await db.from("event_wall").select("*").eq("project_id", projectId).maybeSingle(), "team.wallRetry");
}

export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.events, TEAM_KEYS.edit]);
    requireAllowed(access, TEAM_KEYS.events, "Your role can't open the Event Wall.");
    return { wall: wallView(await loadWall(access.db, projectId)), canEdit: access.allowed(TEAM_KEYS.edit) };
  });
}

// PATCH { name?, tagline?, logoUrl?, slug?, cta? } — columns on the wall row; the call-to-action merges into its metadata.
export async function PATCH(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { row, cta } = parseWallPatch(await readJson(request));
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.edit]);
    requireAllowed(access, TEAM_KEYS.edit, "Your role can't change the Event Wall.");
    let wall = await loadWall(access.db, projectId);
    if (Object.keys(row).length) {
      const saved = await access.db.from("event_wall").update(row).eq("project_id", projectId).select("*").single();
      if (saved.error?.code === "23505") throw new ApiError("conflict", 409, "That web address is already taken. Try another.");
      wall = must(saved, "team.wallSave");
    }
    if (cta) {
      must(await access.db.rpc("event_wall_merge_meta", { p_id: wall.id, p_patch: { cta } }), "team.wallCta");
      wall = { ...wall, metadata: { ...(wall.metadata || {}), cta } };
    }
    return { wall: wallView(wall), canEdit: true };
  });
}
