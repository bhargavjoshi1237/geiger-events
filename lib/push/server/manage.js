import { ManageError, UUID, withProjectManager } from "@/lib/api_webhooks/server/manage";
import { pushDb } from "./store.js";

// Shared guard + helpers for the dashboard's /api/settings/push routes ("Manage settings" on the project).

export { ManageError, UUID };

const FORBIDDEN = "You need the Manage settings permission to change push notifications.";

export function withPushManager(request, projectId, work) {
  return withProjectManager(
    request,
    projectId,
    async (ctx) => {
      const push = pushDb();
      if (!push) throw new ManageError(503, "unavailable", "Push notifications need SUPABASE_SERVICE_ROLE_KEY on the server.");
      return work({ ...ctx, push });
    },
    { forbidden: FORBIDDEN },
  );
}

export function mustPush(result, message) {
  if (result.error) {
    console.error("[settings.push.store]", result.error.message);
    throw new ManageError(500, "store_error", message);
  }
  return result.data;
}

export function logItem(n, member, deliveries = []) {
  return {
    id: n.id,
    type: n.type,
    category: n.category,
    status: n.status,
    skipReason: n.skip_reason || null,
    title: n.title || null,
    body: n.body || null,
    memberName: member?.name || "",
    memberEmail: member?.email || "",
    attempts: n.attempts || 0,
    sendAfter: n.send_after,
    sentAt: n.sent_at || null,
    createdAt: n.created_at,
    lastError: n.last_error || null,
    deliveries: deliveries.map((d) => ({
      platform: d.platform || "unknown",
      status: d.status,
      error: d.error || null,
      receiptStatus: d.receipt_status || null,
      receiptError: d.receipt_error || null,
      createdAt: d.created_at,
    })),
  };
}
