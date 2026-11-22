import { ApiError } from "../../staff_access/errors.js";
import { normalizeVenueBooking } from "../../venue_booking/normalize.js";
import { must } from "../scope.js";
import { bookingViews } from "./booking_data.js";
import { sendBookingEmail } from "./booking_email.js";

// Confirm and cancel run through the same locking RPCs the dashboard uses, then optionally email the venue and booker.

function rpcBooking(data, error, label) {
  if (error) {
    console.error(`[control.sourcing.${label}]`, error.message);
    throw new ApiError("booking_failed", 503, "Couldn't update the booking. Try again.");
  }
  const res = Array.isArray(data) ? data[0] : data;
  if (!res || res.ok !== true) throw new ApiError(res?.code || "booking_failed", 409, res?.message || "Couldn't update the booking.");
  return normalizeVenueBooking(res.booking);
}

export async function runBookingRpc({ db, request, booking, rpc, args, label, emailKind }) {
  const { data, error } = await db.rpc(rpc, { p_booking_id: booking.id, ...args });
  const next = rpcBooking(data, error, label);
  let email = null;
  if (emailKind) {
    const row = must(await db.from("venue_bookings").select("*").eq("id", next.id).maybeSingle(), `${label}.reload`);
    email = row ? await sendBookingEmail({ db, request, row, booking: normalizeVenueBooking(row), kind: emailKind }) : null;
  }
  const fresh = must(await db.from("venue_bookings").select("*").eq("id", next.id).maybeSingle(), `${label}.view`);
  const [view] = await bookingViews(db, [fresh ? normalizeVenueBooking(fresh) : next]);
  return { booking: view, email };
}
