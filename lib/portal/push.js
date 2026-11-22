import { isExpoPushToken } from "@/lib/push/server/expo";
import { pushDb } from "@/lib/push/server/store";

// Member device tokens (events_push.devices). Sending lives in lib/push/server; this file only registers devices.

export { isExpoPushToken };

export async function registerDevice({ memberId, pushToken, platform, appVersion }) {
  const db = pushDb();
  const token = String(pushToken || "").trim();
  if (!db || !memberId || !isExpoPushToken(token)) return false;
  const { error } = await db.from("devices").upsert(
    {
      member_id: memberId,
      push_token: token,
      platform: String(platform || "unknown").slice(0, 40) || "unknown",
      app_version: appVersion ? String(appVersion).slice(0, 40) : null,
      last_seen_at: new Date().toISOString(),
      deleted_at: null,
    },
    { onConflict: "push_token" },
  );
  if (error) {
    console.error("[portal.push.register]", error.message);
    return false;
  }
  return true;
}

// memberId scopes the delete so one member can't unregister another member's device.
export async function unregisterDevice(pushToken, memberId = null) {
  const db = pushDb();
  const token = String(pushToken || "").trim();
  if (!db || !token) return false;
  let q = db.from("devices").update({ deleted_at: new Date().toISOString() }).eq("push_token", token);
  if (memberId) q = q.eq("member_id", memberId);
  const { error } = await q;
  if (error) {
    console.error("[portal.push.unregister]", error.message);
    return false;
  }
  return true;
}

export async function unregisterMemberDevices(memberId) {
  const db = pushDb();
  if (!db || !memberId) return false;
  const { error } = await db
    .from("devices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("member_id", memberId)
    .is("deleted_at", null);
  if (error) {
    console.error("[portal.push.unregisterAll]", error.message);
    return false;
  }
  return true;
}

export async function listMemberDevices(memberId) {
  const db = pushDb();
  if (!db || !memberId) return [];
  const { data, error } = await db
    .from("devices")
    .select("id, push_token, platform, app_version, last_seen_at")
    .eq("member_id", memberId)
    .is("deleted_at", null)
    .order("last_seen_at", { ascending: false });
  if (error) {
    console.error("[portal.push.devices]", error.message);
    return [];
  }
  return data || [];
}
