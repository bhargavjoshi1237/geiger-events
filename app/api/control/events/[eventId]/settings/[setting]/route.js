import { findEventSetting } from "@/lib/control/catalog";
import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { eventScope, must, readJson } from "@/lib/control/scope";
import { parseSettingsPatch, settingsView } from "@/lib/control/settings_engine";
import { ApiError } from "@/lib/staff_access/errors";

function settingOrThrow(id) {
  const descriptor = findEventSetting(String(id || ""));
  if (!descriptor) throw new ApiError("not_found", 404, "That isn't an event setting Control can change.");
  return descriptor;
}

async function readStored(db, eventId, key) {
  const row = must(
    await db.from("events").select("value:metadata->" + key).eq("id", eventId).is("deleted_at", null).maybeSingle(),
    "eventSettings.load",
  );
  if (!row) throw new ApiError("not_found", 404, "Event not found.");
  return row.value ?? null;
}

export async function GET(request, { params }) {
  const { eventId, setting } = await params;
  return withControl(request, async (ctx) => {
    const descriptor = settingOrThrow(setting);
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.events);
    return { values: settingsView(descriptor, await readStored(scope.db, eventId, descriptor.key)) };
  });
}

// PATCH { config } (or { items } for a list section) — merged into the stored section, then into the event's metadata, as the event editor saves it.
export async function PATCH(request, { params }) {
  const { eventId, setting } = await params;
  return withControl(request, async (ctx) => {
    const descriptor = settingOrThrow(setting);
    const body = await readJson(request);
    const scope = await eventScope(ctx, eventId, CONTROL_CAPABILITIES.edit);
    const next = parseSettingsPatch(descriptor, body, await readStored(scope.db, eventId, descriptor.key));
    must(await scope.db.rpc("event_merge_meta", { p_id: eventId, p_patch: { [descriptor.key]: next } }), "eventSettings.save");
    return { values: settingsView(descriptor, next) };
  });
}
