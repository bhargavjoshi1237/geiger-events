import { adminClient } from "@/lib/supabase/admin";

const EXPO_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export function isExpoPushToken(token) {
  return (
    typeof token === "string" &&
    /^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(token.trim())
  );
}

export async function registerDevice({ memberId, pushToken, platform, appVersion }) {
  const sb = adminClient();
  const token = String(pushToken || "").trim();
  if (!sb || !memberId || !isExpoPushToken(token)) return false;
  const { error } = await sb.from("portal_devices").upsert(
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

export async function unregisterDevice(pushToken) {
  const sb = adminClient();
  const token = String(pushToken || "").trim();
  if (!sb || !token) return false;
  const { error } = await sb
    .from("portal_devices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("push_token", token);
  if (error) {
    console.error("[portal.push.unregister]", error.message);
    return false;
  }
  return true;
}

export async function listMemberDevices(memberId) {
  const sb = adminClient();
  if (!sb || !memberId) return [];
  const { data, error } = await sb
    .from("portal_devices")
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

export async function listMemberPushTokens(memberIds) {
  const sb = adminClient();
  const ids = Array.isArray(memberIds) ? memberIds.filter(Boolean) : [];
  if (!sb || !ids.length) return [];
  const { data, error } = await sb
    .from("portal_devices")
    .select("push_token")
    .in("member_id", ids)
    .is("deleted_at", null);
  if (error) {
    console.error("[portal.push.list]", error.message);
    return [];
  }
  return [...new Set((data || []).map((d) => d.push_token).filter(Boolean))];
}

export async function sendExpoPush(tokens, { title, body, data }) {
  const clean = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
  if (!clean.length) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < clean.length; i += BATCH_SIZE) {
    const batch = clean.slice(i, i + BATCH_SIZE).map((to) => ({
      to,
      sound: "default",
      title: title || "",
      body: body || "",
      data: data || {},
      priority: "high",
    }));
    let response;
    try {
      response = await fetch(EXPO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
    } catch (e) {
      console.error("[portal.push.send]", e);
      failed += batch.length;
      continue;
    }
    const json = await response.json().catch(() => null);
    const tickets = Array.isArray(json?.data) ? json.data : [];
    for (let t = 0; t < tickets.length; t += 1) {
      const ticket = tickets[t];
      const token = batch[t]?.to;
      if (ticket?.status === "error") {
        failed += 1;
        if (token && ticket.details?.error === "DeviceNotRegistered") {
          await unregisterDevice(token);
        }
      } else {
        sent += 1;
      }
    }
  }
  return { sent, failed };
}
