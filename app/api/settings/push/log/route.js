import { readJson } from "@/lib/api_webhooks/server/manage";
import { runDispatch } from "@/lib/push/server/dispatch";
import { ManageError, UUID, logItem, mustPush, withPushManager } from "@/lib/push/server/manage";
import { enqueue, listDevicesFor } from "@/lib/push/server/store";
import { PUSH_TYPE_KEYS } from "@/lib/push/types";
import { adminClient } from "@/lib/supabase/admin";

// Delivery log for the dashboard, plus retry and "send a test to my device".
export const maxDuration = 30;

const PAGE = 50;
const STATUSES = new Set(["queued", "sending", "sent", "failed", "skipped"]);
// Postgres timestamptz as PostgREST returns it, e.g. 2026-11-22T10:00:00.123456+00:00; nothing else reaches the filter.
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const COLS = "id, type, category, status, skip_reason, title, body, member_id, attempts, send_after, sent_at, created_at, last_error";

async function hydrate(push, rows) {
  const sb = adminClient();
  const memberIds = [...new Set(rows.map((r) => r.member_id))];
  const [members, deliveries] = await Promise.all([
    memberIds.length ? sb.from("portal_members").select("id, name, email").in("id", memberIds) : { data: [] },
    rows.length
      ? push.from("deliveries").select("notification_id, platform, status, error, receipt_status, receipt_error, created_at").in("notification_id", rows.map((r) => r.id))
      : { data: [] },
  ]);
  const memberBy = new Map((members.data || []).map((m) => [m.id, m]));
  const deliveriesBy = new Map();
  for (const d of deliveries.data || []) (deliveriesBy.get(d.notification_id) || deliveriesBy.set(d.notification_id, []).get(d.notification_id)).push(d);
  return rows.map((r) => logItem(r, memberBy.get(r.member_id), deliveriesBy.get(r.id) || []));
}

// cursor = "<created_at>|<id>" of the last row on the previous page.
export async function GET(request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  return withPushManager(request, projectId, async ({ push }) => {
    let q = push.from("notifications").select(COLS).eq("project_id", projectId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE + 1);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const cursor = url.searchParams.get("cursor");
    if (status && STATUSES.has(status)) q = q.eq("status", status);
    if (type && PUSH_TYPE_KEYS.includes(type)) q = q.eq("type", type);
    if (cursor) {
      const [at, id] = cursor.split("|");
      if (ISO_TS.test(at || "") && UUID.test(id || "")) {
        q = q.or(`created_at.lt."${at}",and(created_at.eq."${at}",id.lt.${id})`);
      }
    }
    const rows = mustPush(await q, "Couldn't load the delivery log.");
    const page = rows.slice(0, PAGE);
    const last = page.at(-1);
    return {
      items: await hydrate(push, page),
      nextCursor: rows.length > PAGE && last ? `${last.created_at}|${last.id}` : null,
    };
  });
}

async function retry(push, projectId, id) {
  if (!UUID.test(id ?? "")) throw new ManageError(400, "invalid_request", "Choose a notification.");
  const row = mustPush(await push.from("notifications").select("id, status").eq("id", id).eq("project_id", projectId).maybeSingle(), "Couldn't load the notification.");
  if (!row) throw new ManageError(404, "not_found", "That notification no longer exists.");
  if (!["failed", "skipped"].includes(row.status)) throw new ManageError(409, "not_retryable", "Only failed or skipped notifications can be retried.");
  mustPush(
    await push.from("notifications").update({ status: "queued", skip_reason: null, attempts: 0, last_error: null, send_after: new Date().toISOString(), expires_at: null }).eq("id", id),
    "Couldn't queue the retry.",
  );
  await runDispatch({ ids: [id] });
  const fresh = mustPush(await push.from("notifications").select(COLS).eq("id", id).single(), "Couldn't load the notification.");
  return { item: (await hydrate(push, [fresh]))[0] };
}

// Sent to the organiser's own portal account (same email), bypassing switches and mutes so setup can be checked.
async function test(push, projectId, userId) {
  const sb = adminClient();
  const { data: user } = await sb.auth.admin.getUserById(userId);
  const email = user?.user?.email || "";
  if (!email) return { ok: false, sent: 0, message: "Your account has no email address to match an app account." };
  const { data: member } = await sb.from("portal_members").select("id").ilike("email", email.replace(/[\\%_]/g, "\\$&")).maybeSingle();
  if (!member) return { ok: false, sent: 0, message: `Sign in to the Geiger Events app as ${email} first, then try again.` };
  const devices = await listDevicesFor([member.id]);
  if (!devices.length) return { ok: false, sent: 0, message: `No device is registered for ${email}. Open the app and allow notifications.` };

  const dedupe = `test:${projectId}:${Date.now()}`;
  await enqueue({
    projectId,
    type: "test",
    memberIds: [member.id],
    ref: { copy: { title: "Push notifications are working", body: "This is a test from your Geiger Events dashboard.", route: "/notifications" } },
    dedupe,
  });
  const row = mustPush(await push.from("notifications").select("id").eq("dedupe_key", `${dedupe}:${member.id}`).single(), "Couldn't queue the test.");
  const result = await runDispatch({ ids: [row.id] });
  const after = mustPush(await push.from("notifications").select("status, last_error").eq("id", row.id).single(), "Couldn't read the test result.");
  if (after.status === "sent") {
    return { ok: true, sent: devices.length, message: `Test sent to ${devices.length} ${devices.length === 1 ? "device" : "devices"}.` };
  }
  return { ok: false, sent: 0, message: after.last_error || result.error || "Expo didn't accept the test. Check the delivery log." };
}

// POST { projectId, action: "retry", id } -> { item }; { projectId, action: "test" } -> { ok, sent, message }.
export async function POST(request) {
  const body = await readJson(request);
  return withPushManager(request, body.projectId, async ({ push, userId }) => {
    if (body.action === "retry") return retry(push, body.projectId, body.id);
    if (body.action === "test") return test(push, body.projectId, userId);
    throw new ManageError(400, "invalid_request", "Unknown action.");
  });
}
