import { TEST_EVENT_SAMPLE, TEST_EVENT_TYPE } from "@/lib/api_webhooks/catalog";
import { dispatchWebhooks } from "@/lib/api_webhooks/server/dispatch";
import { ManageError, UUID, must, readJson, withProjectManager } from "@/lib/api_webhooks/server/manage";

// Manual sends from the dashboard, delivered immediately so the screen can show the outcome.
export const maxDuration = 30;

async function sendNow(deliveryId) {
  const batch = await dispatchWebhooks({ ids: [deliveryId], limit: 1 });
  if (!batch.ok) throw new ManageError(500, "dispatch_failed", "Couldn't send it. Please try again.");
  return { deliveryId, result: batch.results[0] || null, busy: batch.claimed === 0 };
}

async function loadEndpoint(db, projectId, id) {
  if (!UUID.test(id ?? "")) throw new ManageError(400, "invalid_request", "Choose an endpoint.");
  const endpoint = must(
    await db
      .from("webhook_endpoints")
      .select("id")
      .eq("id", id)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle(),
    "Couldn't load the endpoint.",
  );
  if (!endpoint) throw new ManageError(404, "not_found", "That endpoint no longer exists.");
  return endpoint;
}

async function loadDelivery(db, projectId, id) {
  if (!UUID.test(id ?? "")) throw new ManageError(400, "invalid_request", "Choose a delivery.");
  const delivery = must(
    await db
      .from("webhook_deliveries")
      .select("id,event_id,endpoint_id,event_type,status")
      .eq("id", id)
      .eq("project_id", projectId)
      .maybeSingle(),
    "Couldn't load the delivery.",
  );
  if (!delivery) throw new ManageError(404, "not_found", "That delivery no longer exists.");
  await loadEndpoint(db, projectId, delivery.endpoint_id);
  return delivery;
}

// POST { projectId, action: "test" | "retry" | "replay", endpointId?, deliveryId? } → { deliveryId, result, busy }.
export async function POST(request) {
  const body = await readJson(request);
  return withProjectManager(request, body.projectId, async ({ db }) => {
    if (body.action === "test") {
      const endpoint = await loadEndpoint(db, body.projectId, body.endpointId);
      const event = must(
        await db
          .from("webhook_events")
          .insert({
            project_id: body.projectId,
            type: TEST_EVENT_TYPE,
            payload: { ...TEST_EVENT_SAMPLE, endpoint_id: endpoint.id },
          })
          .select("id")
          .single(),
        "Couldn't create the test event.",
      );
      const delivery = must(
        await db
          .from("webhook_deliveries")
          .insert({
            project_id: body.projectId,
            event_id: event.id,
            endpoint_id: endpoint.id,
            event_type: TEST_EVENT_TYPE,
            origin: "test",
          })
          .select("id")
          .single(),
        "Couldn't queue the test event.",
      );
      return sendNow(delivery.id);
    }

    if (body.action === "retry") {
      const delivery = await loadDelivery(db, body.projectId, body.deliveryId);
      if (delivery.status === "succeeded") {
        throw new ManageError(409, "already_delivered", "This was already delivered. Use Replay to send it again.");
      }
      if (delivery.status === "dead") {
        must(
          await db
            .from("webhook_deliveries")
            .update({ status: "failed", next_attempt_at: new Date().toISOString() })
            .eq("id", delivery.id)
            .eq("status", "dead"),
          "Couldn't retry the delivery.",
        );
      }
      return sendNow(delivery.id);
    }

    if (body.action === "replay") {
      const original = await loadDelivery(db, body.projectId, body.deliveryId);
      const replay = must(
        await db
          .from("webhook_deliveries")
          .insert({
            project_id: body.projectId,
            event_id: original.event_id,
            endpoint_id: original.endpoint_id,
            event_type: original.event_type,
            origin: "replay",
            replay_of: original.id,
          })
          .select("id")
          .single(),
        "Couldn't replay the delivery.",
      );
      return sendNow(replay.id);
    }

    throw new ManageError(400, "invalid_request", "Unknown action.");
  });
}
