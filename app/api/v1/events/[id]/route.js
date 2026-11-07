import { apiRoute, callRpc, notFound, parseUuid } from "@/lib/api_webhooks/server/public_api";

// GET /api/v1/events/{id}
export const GET = apiRoute("read:events", async ({ db, projectId, params }) => {
  const id = parseUuid(params.id, "id", { required: true });
  const event = await callRpc(db, "api_get_event", { p_project: projectId, p_id: id });
  if (!event) throw notFound("event");
  return { body: event };
});
