import { sendBookingEmails } from "../../venue_booking/notify.js";

// Instant Book emails for Control: the same sender the dashboard's /api/venue-bookings/notify uses, run on the app's
// user-scoped client so RLS still scopes the booking.

function siteBase(request) {
  return `${new URL(request.url).origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}`;
}

export async function sendBookingEmail({ db, request, row, booking, kind }) {
  const { noRecipients: _noRecipients, ...result } = await sendBookingEmails({ db, baseUrl: siteBase(request), row, booking, kind });
  return result;
}
