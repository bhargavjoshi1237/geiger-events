import { ApiError } from "../../staff_access/errors.js";
import { checkSlot } from "../../venue_booking/availability.js";
import { formatMoney, describeItem } from "../../venue_booking/pricing.js";
import { requireId } from "../ids.js";
import { must } from "../scope.js";
import { spaceBookings } from "./booking_data.js";
import { slotInstants, spaceFromRow } from "./bookings.js";

// One bookable space in this project with its venue's clock, then the dashboard's full slot check against live bookings.
export async function checkRequest(db, projectId, request) {
  requireId(request.spaceId);
  const spaceRow = must(
    await db.from("venue_spaces").select("*").eq("id", request.spaceId).eq("project_id", projectId).is("deleted_at", null).maybeSingle(),
    "bookings.spaceLoad",
  );
  if (!spaceRow || spaceRow.bookable !== true) throw new ApiError("invalid_input", 400, "That space isn't open for Instant Book.");
  const venue = must(await db.from("venues").select("id,name,timezone").eq("id", spaceRow.venue_id).is("deleted_at", null).maybeSingle(), "bookings.venueLoad");
  if (!venue) throw new ApiError("invalid_input", 400, "That space's venue has been removed.");
  const space = spaceFromRow(spaceRow);
  const { startsAt, endsAt, timeZone } = slotInstants(request, venue.timezone);
  const check = checkSlot({
    space,
    timeZone,
    startsAt,
    endsAt,
    bookings: await spaceBookings(db, space.id),
    setupStyle: request.setupStyle,
    attendees: request.attendees,
  });
  return { space, venue, startsAt, endsAt, timeZone, check };
}

// The quote as the app shows it: one line per venue-local day, then the total.
export function quoteView(quote) {
  if (!quote) return null;
  return {
    currency: quote.currency,
    total: formatMoney(quote.total, quote.currency),
    priced: quote.priced !== false,
    lines: (quote.lines || []).map((line) => ({
      date: line.date,
      amount: formatMoney(line.amount, quote.currency),
      detail: line.items?.length ? line.items.map((it) => describeItem(it, quote.currency)).join(" + ") : "No charge",
    })),
  };
}
