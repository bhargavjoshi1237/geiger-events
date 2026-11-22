import { userDb } from "../boundary.js";
import { requireId } from "../ids.js";
import { must, projectScope } from "../scope.js";
import { ApiError } from "../../staff_access/errors.js";

// A record read as the user first (RLS hides other projects), then authorised against its own project.
export async function ownedScope(ctx, { table, id, permission, notFound, columns = "*", softDelete = true }) {
  requireId(id);
  let query = userDb(ctx.token).from(table).select(columns).eq("id", id);
  if (softDelete) query = query.is("deleted_at", null);
  const row = must(await query.maybeSingle(), `${table}.load`);
  if (!row?.project_id) throw new ApiError("not_found", 404, notFound);
  const scope = await projectScope(ctx, row.project_id, permission);
  return { ...scope, row };
}

export const EVENT_COLUMNS = "id,name,status,event_date,event_time,venue,city,timezone,capacity,sold,cover_url,series_id";

export const OPS_PERMISSIONS = {
  events: "events.events.view",
  edit: "events.event.edit",
  venues: "events.venues.view",
  workflows: "events.workflows.view",
  campaigns: "events.campaigns.view",
  analytics: "events.analytics.view",
};
