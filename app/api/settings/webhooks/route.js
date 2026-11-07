import { normalizeEventTypes } from "@/lib/api_webhooks/catalog";
import { generateWebhookSecret } from "@/lib/api_webhooks/crypto";
import {
  ENDPOINT_COLUMNS,
  ManageError,
  UUID,
  must,
  readJson,
  withProjectManager,
} from "@/lib/api_webhooks/server/manage";
import { checkWebhookUrl } from "@/lib/api_webhooks/url";

const MAX_ENDPOINTS = 20;

function cleanUrl(value) {
  const check = checkWebhookUrl(value);
  if (!check.ok) throw new ManageError(400, "invalid_url", check.error);
  return check.value;
}

function cleanEventTypes(value) {
  const types = normalizeEventTypes(value);
  if (!types.length) throw new ManageError(400, "invalid_request", "Choose at least one event to send.");
  return types;
}

// POST { projectId, url, description, eventTypes } → { endpoint }. The signing secret is generated here.
export async function POST(request) {
  const body = await readJson(request);
  return withProjectManager(request, body.projectId, async ({ db, userId }) => {
    const url = cleanUrl(body.url);
    const eventTypes = cleanEventTypes(body.eventTypes);
    const { count } = await db
      .from("webhook_endpoints")
      .select("id", { count: "exact", head: true })
      .eq("project_id", body.projectId)
      .is("deleted_at", null);
    if ((count || 0) >= MAX_ENDPOINTS) {
      throw new ManageError(409, "limit_reached", `A project can have ${MAX_ENDPOINTS} webhook endpoints.`);
    }
    const endpoint = must(
      await db
        .from("webhook_endpoints")
        .insert({
          project_id: body.projectId,
          url,
          description: String(body.description || "").trim().slice(0, 200),
          event_types: eventTypes,
          secret: generateWebhookSecret(),
          created_by: userId,
        })
        .select(ENDPOINT_COLUMNS)
        .single(),
      "Couldn't add the endpoint. Please try again.",
    );
    return { endpoint };
  });
}

// PATCH { projectId, id, url?, description?, eventTypes?, active? } → { endpoint }.
export async function PATCH(request) {
  const body = await readJson(request);
  return withProjectManager(request, body.projectId, async ({ db }) => {
    if (!UUID.test(body.id ?? "")) throw new ManageError(400, "invalid_request", "Choose an endpoint.");
    const patch = {};
    if ("url" in body) patch.url = cleanUrl(body.url);
    if ("description" in body) patch.description = String(body.description || "").trim().slice(0, 200);
    if ("eventTypes" in body) patch.event_types = cleanEventTypes(body.eventTypes);
    if ("active" in body) {
      patch.active = body.active === true;
      // Turning back on clears an automatic shut-off; turning off is a choice, so there's no reason to show.
      patch.disabled_at = patch.active ? null : new Date().toISOString();
      patch.disabled_reason = null;
      if (patch.active) patch.failure_streak = 0;
    }
    if (!Object.keys(patch).length) throw new ManageError(400, "invalid_request", "Nothing to change.");
    const endpoint = must(
      await db
        .from("webhook_endpoints")
        .update(patch)
        .eq("id", body.id)
        .eq("project_id", body.projectId)
        .is("deleted_at", null)
        .select(ENDPOINT_COLUMNS)
        .maybeSingle(),
      "Couldn't save the endpoint. Please try again.",
    );
    if (!endpoint) throw new ManageError(404, "not_found", "That endpoint no longer exists.");
    return { endpoint };
  });
}

// DELETE { projectId, id } → { ok }. Soft-deletes the endpoint and stops its queued deliveries.
export async function DELETE(request) {
  const body = await readJson(request);
  return withProjectManager(request, body.projectId, async ({ db }) => {
    if (!UUID.test(body.id ?? "")) throw new ManageError(400, "invalid_request", "Choose an endpoint.");
    const removed = must(
      await db
        .from("webhook_endpoints")
        .update({ deleted_at: new Date().toISOString(), active: false })
        .eq("id", body.id)
        .eq("project_id", body.projectId)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle(),
      "Couldn't delete the endpoint. Please try again.",
    );
    if (!removed) throw new ManageError(404, "not_found", "That endpoint no longer exists.");
    const { error } = await db
      .from("webhook_deliveries")
      .update({ status: "dead", next_attempt_at: null, last_error: "Endpoint deleted before delivery." })
      .eq("endpoint_id", body.id)
      .in("status", ["pending", "failed"]);
    if (error) console.error("[settings.webhooks.delete]", error.message);
    return { ok: true };
  });
}
