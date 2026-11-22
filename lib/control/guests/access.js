import { ApiError } from "../../staff_access/errors.js";
import { userDb } from "../boundary.js";
import { requireId } from "../ids.js";
import { must, projectScope } from "../scope.js";

// The Guests and Registrations areas open with their sidebar view keys, for reads and writes alike, as on the dashboard.
export const GUESTS = "events.guests.view";
export const REGISTRATIONS = "events.registrations.view";

// A project-owned row, read as the user first (RLS hides other projects), then authorised against its own project.
export async function projectRow(ctx, { table, id, columns = "*", permission, notFound }) {
  requireId(id);
  const row = must(await userDb(ctx.token).from(table).select(columns).eq("id", id).is("deleted_at", null).maybeSingle(), `${table}.load`);
  if (!row?.project_id) throw new ApiError("not_found", 404, notFound);
  return { ...(await projectScope(ctx, row.project_id, permission)), row };
}
