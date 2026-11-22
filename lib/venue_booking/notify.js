import { sendNotificationEmail } from "../email/notifications.js";
import { renderBookingEmail } from "./email.js";
import { googleCalendarUrl } from "./ics.js";

// Instant Book emails (confirmation / hold notice / cancellation) to the venue contact and the booker. Shared by the
// dashboard's /api/venue-bookings/notify and Control; `db` is the caller's own user-scoped client, so RLS scopes every read.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOG_LIMIT = 20;

export async function sendBookingEmails({ db, baseUrl, row, booking, kind }) {
  const [{ data: venue }, { data: space }, eventRes] = await Promise.all([
    db.from("venues").select("name, address, city, postcode, country, timezone, contact_name, contact_email").eq("id", booking.venueId).maybeSingle(),
    db.from("venue_spaces").select("name").eq("id", booking.spaceId).maybeSingle(),
    booking.eventId ? db.from("events").select("name").eq("id", booking.eventId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const recipients = [];
  const venueEmail = String(venue?.contact_email || "").trim().toLowerCase();
  if (EMAIL.test(venueEmail)) recipients.push({ role: "venue", to: venueEmail, name: venue?.contact_name || "" });
  const bookerEmail = String(booking.contactEmail || "").trim().toLowerCase();
  if (EMAIL.test(bookerEmail) && bookerEmail !== venueEmail) {
    recipients.push({ role: "booker", to: bookerEmail, name: booking.contactName || "" });
  }
  if (!recipients.length) {
    return { ok: false, noRecipients: true, sent: [], error: "Add a contact email to the venue or the booking first." };
  }

  const spaceName = space?.name || "Venue space";
  const venueName = venue?.name || "";
  const venueAddress = [venue?.address, venue?.city, venue?.postcode, venue?.country].filter(Boolean).join(", ");
  const eventName = eventRes?.data?.name || "";
  const timeZone = booking.timezone || venue?.timezone || "UTC";
  const icsUrl = `${baseUrl}/api/venue-bookings/ics?token=${row.public_token}`;
  const googleUrl = googleCalendarUrl({ booking, spaceName, venueName, address: venueAddress, eventName });
  const notification = kind === "cancellation" ? "booking_cancelled" : "booking_confirmation";

  const sent = [];
  for (const r of recipients) {
    const { subject, html } = renderBookingEmail({
      kind,
      role: r.role,
      recipientName: r.name,
      booking,
      spaceName,
      venueName,
      venueAddress,
      eventName,
      timeZone,
      icsUrl,
      googleUrl,
    });
    const res = await sendNotificationEmail({
      projectId: booking.projectId,
      notification,
      template: `events.${notification}`,
      to: r.to,
      subject,
      html,
      data: { reference: booking.reference, kind, role: r.role },
    });
    sent.push({
      role: r.role,
      to: r.to,
      status: res.ok ? "sent" : res.skipped ? "off" : "failed",
      ...(res.ok || res.skipped ? {} : { error: String(res.error || "") }),
    });
  }

  // Keep a short send log on the booking for the drawer.
  const at = new Date().toISOString();
  const log = [...sent.map((s) => ({ ...s, kind, at })), ...(Array.isArray(booking.metadata.emails) ? booking.metadata.emails : [])].slice(0, LOG_LIMIT);
  const { error: logError } = await db.from("venue_bookings").update({ metadata: { ...booking.metadata, emails: log } }).eq("id", booking.id);
  if (logError) console.error("[venue-bookings.notify] log", logError.message);

  const ok = sent.some((s) => s.status === "sent");
  const off = sent.every((s) => s.status === "off");
  return {
    ok,
    sent,
    error: ok ? "" : off ? "Booking emails are switched off in Notifications." : sent.find((s) => s.error)?.error || "Couldn't send.",
  };
}
