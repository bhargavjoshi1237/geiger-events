import { apiRoute, callRpc, listBody, parseEnum, parsePage, parseTime } from "@/lib/api_webhooks/server/public_api";

// GET /api/v1/events?status=&updated_since=&limit=&starting_after=
export const GET = apiRoute("read:events", async ({ db, projectId, query }) => {
  const { limit, startingAfter } = parsePage(query);
  const result = await callRpc(db, "api_list_events", {
    p_project: projectId,
    p_limit: limit,
    p_starting_after: startingAfter,
    p_status: parseEnum(query.get("status"), "status"),
    p_updated_since: parseTime(query.get("updated_since"), "updated_since"),
  });
  return listBody(result);
});
