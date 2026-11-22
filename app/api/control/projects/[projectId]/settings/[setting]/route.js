import { findSetting, sectionOf } from "@/lib/control/catalog";
import { withControl } from "@/lib/control/http";
import { must, projectScope, readJson } from "@/lib/control/scope";
import { parseSettingsPatch, settingsView, SETTINGS_STORES } from "@/lib/control/settings_engine";
import { ApiError } from "@/lib/staff_access/errors";

async function settingScope(ctx, projectId, id) {
  const descriptor = findSetting(String(id || ""));
  if (!descriptor || !SETTINGS_STORES[descriptor.store]) throw new ApiError("not_found", 404, "That isn't a setting Control can change.");
  return { descriptor, ...(await projectScope(ctx, projectId, sectionOf(descriptor).permission)) };
}

// The stored slice: a feature's part of the project's check-in settings, or the module's ticketing settings row.
async function readStored({ db, projectId, descriptor }) {
  if (descriptor.store === "checkin") {
    const row = must(
      await db.from("checkin_settings").select("config").eq("project_id", projectId).is("deleted_at", null).maybeSingle(),
      "settings.checkin",
    );
    return row?.config?.[descriptor.key] ?? null;
  }
  const row = must(
    await db.from("ticketing_settings").select("config").eq("project_id", projectId).eq("module", descriptor.key).maybeSingle(),
    "settings.ticketing",
  );
  return row?.config ?? null;
}

export async function GET(request, { params }) {
  const { projectId, setting } = await params;
  return withControl(request, async (ctx) => {
    const scope = await settingScope(ctx, projectId, setting);
    return { values: settingsView(scope.descriptor, await readStored(scope)) };
  });
}

// PATCH { config } — validated against the setting's fields, merged into the stored slice, saved the way the dashboard saves it.
export async function PATCH(request, { params }) {
  const { projectId, setting } = await params;
  return withControl(request, async (ctx) => {
    const body = await readJson(request);
    const scope = await settingScope(ctx, projectId, setting);
    const next = parseSettingsPatch(scope.descriptor, body, await readStored(scope));
    if (scope.descriptor.store === "checkin") {
      must(await scope.db.rpc("checkin_settings_merge", { p_project: projectId, p_patch: { [scope.descriptor.key]: next } }), "settings.checkinSave");
    } else {
      must(
        await scope.db
          .from("ticketing_settings")
          .upsert({ project_id: projectId, module: scope.descriptor.key, config: next }, { onConflict: "project_id,module" }),
        "settings.ticketingSave",
      );
    }
    return { values: settingsView(scope.descriptor, next) };
  });
}
