import { withControl } from "@/lib/control/http";
import { must, projectPermissions, readJson } from "@/lib/control/scope";
import { TEAM_KEYS, requireAllowed } from "@/lib/control/team/keys";
import { parseProfilePatch, profileView } from "@/lib/control/team/profiles";

// The organiser profile shown on the public Event Wall; one row per project, created on first read as the dashboard does.
async function loadProfile(db, projectId) {
  const existing = must(await db.from("organiser_profile").select("*").eq("project_id", projectId).is("deleted_at", null).maybeSingle(), "team.profile");
  if (existing) return existing;
  const created = await db.from("organiser_profile").insert({ project_id: projectId }).select("*").single();
  if (!created.error) return created.data;
  // Someone else created it between the read and the insert.
  return must(await db.from("organiser_profile").select("*").eq("project_id", projectId).is("deleted_at", null).maybeSingle(), "team.profileRetry");
}

export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.discovery]);
    requireAllowed(access, TEAM_KEYS.discovery, "Your role can't open Discovery.");
    const followers = await access.db.from("organiser_followers").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    return { profile: profileView(await loadProfile(access.db, projectId)), followers: followers.count ?? 0 };
  });
}

// PATCH — any of the profile's fields; links without a URL are dropped, as on the dashboard.
export async function PATCH(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseProfilePatch(await readJson(request));
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.discovery]);
    requireAllowed(access, TEAM_KEYS.discovery, "Your role can't change the organiser profile.");
    await loadProfile(access.db, projectId);
    const row = must(await access.db.from("organiser_profile").update(patch).eq("project_id", projectId).is("deleted_at", null).select("*").single(), "team.profileSave");
    return { profile: profileView(row) };
  });
}
