import { ApiError } from "../../staff_access/errors.js";
import { normalizeBid, normalizeRfp } from "../../sourcing/rows.js";
import { normalizeVenueBooking } from "../../venue_booking/normalize.js";
import { userDb } from "../boundary.js";
import { requireId } from "../ids.js";
import { must, projectScope } from "../scope.js";

// Sourcing sits behind the Sourcing sidebar key, for reading and changing alike — the dashboard gates it the same way.
export const SOURCING = "events.sourcing.view";

export const sourcingProject = (ctx, projectId) => projectScope(ctx, projectId, SOURCING);

// A record is read as the user first (RLS hides other projects), then authorised against its own project, never the URL's.
async function owned(ctx, table, id, notFound) {
  requireId(id);
  const row = must(await userDb(ctx.token).from(table).select("*").eq("id", id).is("deleted_at", null).maybeSingle(), `${table}.load`);
  if (!row?.project_id) throw new ApiError("not_found", 404, notFound);
  return { row, scope: await sourcingProject(ctx, row.project_id) };
}

export async function rfpScope(ctx, rfpId) {
  const { row, scope } = await owned(ctx, "rfps", rfpId, "RFP not found.");
  return { ...scope, rfp: normalizeRfp(row) };
}

export async function bidScope(ctx, bidId) {
  const { row, scope } = await owned(ctx, "rfp_bids", bidId, "Bid not found.");
  return { ...scope, bid: normalizeBid(row) };
}

export async function recipientScope(ctx, recipientId) {
  const { row, scope } = await owned(ctx, "rfp_recipients", recipientId, "Recipient not found.");
  return { ...scope, recipient: row };
}

export async function bookingScope(ctx, bookingId) {
  const { row, scope } = await owned(ctx, "venue_bookings", bookingId, "Booking not found.");
  return { ...scope, row, booking: normalizeVenueBooking(row) };
}

// A linked event must be one of this project's own, whatever id the request names.
export async function assertProjectEvent(db, projectId, eventId) {
  if (!eventId) return;
  requireId(eventId);
  const event = must(await db.from("events").select("id").eq("id", eventId).eq("project_id", projectId).is("deleted_at", null).maybeSingle(), "sourcing.event");
  if (!event) throw new ApiError("invalid_input", 400, "That event isn't in this project.");
}
