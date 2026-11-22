import { NOTIFICATIONS_MODULE } from "@/lib/email/catalog";
import { withControl } from "@/lib/control/http";
import { must, projectPermissions, readJson } from "@/lib/control/scope";
import { TEAM_KEYS, requireAllowed } from "@/lib/control/team/keys";
import { notificationsView, parseNotificationsPatch } from "@/lib/control/team/notifications";

async function stored(db, projectId) {
  const row = must(
    await db.from("ticketing_settings").select("config").eq("project_id", projectId).eq("module", NOTIFICATIONS_MODULE).maybeSingle(),
    "team.notifications",
  );
  return row?.config ?? null;
}

// GET — which of this project's emails may go out, grouped as on the dashboard's Email tab.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.view, TEAM_KEYS.manage]);
    requireAllowed(access, TEAM_KEYS.view, "Your role can't see notification settings.");
    return { ...notificationsView(await stored(access.db, projectId)), canManage: access.allowed(TEAM_KEYS.manage) };
  });
}

// PATCH { enabled?, types? } — merged over the saved config and upserted whole, like the dashboard's save.
export async function PATCH(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.manage]);
    requireAllowed(access, TEAM_KEYS.manage, "Your role can't change notification settings.");
    const next = parseNotificationsPatch(body, await stored(access.db, projectId));
    must(
      await access.db.from("ticketing_settings").upsert({ project_id: projectId, module: NOTIFICATIONS_MODULE, config: next }, { onConflict: "project_id,module" }),
      "team.notificationsSave",
    );
    return { ...notificationsView(next), canManage: true };
  });
}
