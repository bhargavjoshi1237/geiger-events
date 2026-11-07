import { apiRoute, callRpc, notFound, parseUuid } from "@/lib/api_webhooks/server/public_api";

// GET /api/v1/orders/{id}
export const GET = apiRoute("read:orders", async ({ db, projectId, params }) => {
  const id = parseUuid(params.id, "id", { required: true });
  const order = await callRpc(db, "api_get_order", { p_project: projectId, p_id: id });
  if (!order) throw notFound("order");
  return { body: order };
});
