import { appConfigView, mergeAppConfig } from "@/lib/control/final/app_config";
import { withControl } from "@/lib/control/http";
import { must, projectScope, readJson } from "@/lib/control/scope";

// The dashboard's Branded App screen opens and saves under the Broadcast & On-demand view key.
const PERMISSION = "events.broadcast_on_demand.view";

async function stored(db, projectId) {
  return must(await db.from("app_configs").select("config").eq("project_id", projectId).maybeSingle(), "brandedApp.load")?.config ?? null;
}

export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, PERMISSION);
    return { config: appConfigView(await stored(scope.db, projectId)) };
  });
}

// PUT { sections?, home? } — merged over the stored config and upserted whole, like the dashboard's autosave.
export async function PUT(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const scope = await projectScope(ctx, projectId, PERMISSION);
    const next = mergeAppConfig(await stored(scope.db, projectId), body);
    const saved = must(
      await scope.db
        .from("app_configs")
        .upsert({ project_id: projectId, config: next, updated_by: ctx.principal.id }, { onConflict: "project_id" })
        .select("config")
        .single(),
      "brandedApp.save",
    );
    return { config: appConfigView(saved.config) };
  });
}
