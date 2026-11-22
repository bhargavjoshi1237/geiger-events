import { readJson } from "@/lib/api_webhooks/server/manage";
import { withPushManager } from "@/lib/push/server/manage";
import { getProjectSettings, saveProjectSettings } from "@/lib/push/server/store";

// GET ?projectId= -> { settings }; PUT { projectId, settings } -> { settings } (normalised).
export async function GET(request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  return withPushManager(request, projectId, async () => ({ settings: await getProjectSettings(projectId) }));
}

export async function PUT(request) {
  const body = await readJson(request);
  return withPushManager(request, body.projectId, async ({ userId }) => ({
    settings: await saveProjectSettings(body.projectId, body.settings, userId),
  }));
}
