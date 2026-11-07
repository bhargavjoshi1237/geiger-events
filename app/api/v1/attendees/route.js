import {
  apiRoute,
  callRpc,
  listBody,
  parseEnum,
  parsePage,
  parseTime,
  parseUuid,
} from "@/lib/api_webhooks/server/public_api";

// GET /api/v1/attendees?event_id=&status=&updated_since=&limit=&starting_after=
export const GET = apiRoute("read:attendees", async ({ db, projectId, query }) => {
  const { limit, startingAfter } = parsePage(query);
  const result = await callRpc(db, "api_list_attendees", {
    p_project: projectId,
    p_limit: limit,
    p_starting_after: startingAfter,
    p_event: parseUuid(query.get("event_id"), "event_id"),
    p_status: parseEnum(query.get("status"), "status"),
    p_updated_since: parseTime(query.get("updated_since"), "updated_since"),
  });
  return listBody(result);
});
