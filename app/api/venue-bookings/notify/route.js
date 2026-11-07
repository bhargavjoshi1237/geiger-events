import { NextResponse } from "next/server";

import { sendNotificationEmail } from "@/lib/email/notifications";
import { sessionClient } from "@/lib/pay/server";
import { renderBookingEmail } from "@/lib/venue_booking/email";
import { googleCalendarUrl } from "@/lib/venue_booking/ics";
import { normalizeVenueBooking } from "@/lib/venue_booking/normalize";

// Instant Book emails: confirmation / hold notice / cancellation to the venue contact and the booker.
// Signed-in suite users only; the booking is read through their own session, so RLS scopes access.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(["confirmation", "hold", "cancellation"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOG_LIMIT = 20;

function siteBase(request) {
  let origin = "";
  try {
    const header = request.headers.get("origin");
    origin = header && /^https?:\/\//i.test(header) ? new URL(header).origin : request.nextUrl.origin;
  } catch {
    origin = request.nextUrl.origin;
  }
  return `${origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}`;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const bookingId = String(body?.bookingId || "");
  const kind = String(body?.kind || "");
  if (!UUID.test(bookingId) || !KINDS.has(kind)) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const session = await sessionClient();
  if (!session) return NextResponse.json({ ok: false, error: "Sign-in is unavailable right now." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });

  const sb = session.schema("events");
  const { data: row, error } = await sb
    .from("venue_bookings")
    .select("*")
    .eq("id", bookingId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[venue-bookings.notify]", error.message);
    return NextResponse.json({ ok: false, error: "Couldn't load the booking." }, { status: 500 });
  }
  if (!row) return NextResponse.json({ ok: false, error: "Booking not found." }, { status: 404 });
  const booking = normalizeVenueBooking(row);

  const [{ data: venue }, { data: space }, eventRes] = await Promise.all([
    sb.from("venues").select("name, address, city, postcode, country, timezone, contact_name, contact_email").eq("id", booking.venueId).maybeSingle(),
    sb.from("venue_spaces").select("name").eq("id", booking.spaceId).maybeSingle(),
    booking.eventId ? sb.from("events").select("name").eq("id", booking.eventId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const recipients = [];
  const venueEmail = String(venue?.contact_email || "").trim().toLowerCase();
  if (EMAIL.test(venueEmail)) recipients.push({ role: "venue", to: venueEmail, name: venue?.contact_name || "" });
  const bookerEmail = String(booking.contactEmail || "").trim().toLowerCase();
  if (EMAIL.test(bookerEmail) && bookerEmail !== venueEmail) {
    recipients.push({ role: "booker", to: bookerEmail, name: booking.contactName || "" });
  }
  if (!recipients.length) {
    return NextResponse.json(
      { ok: false, error: "Add a contact email to the venue or the booking first.", sent: [] },
      { status: 409 },
    );
  }

  const spaceName = space?.name || "Venue space";
  const venueName = venue?.name || "";
  const venueAddress = [venue?.address, venue?.city, venue?.postcode, venue?.country].filter(Boolean).join(", ");
  const eventName = eventRes?.data?.name || "";
  const timeZone = booking.timezone || venue?.timezone || "UTC";
  const calendar = { booking, spaceName, venueName, address: venueAddress, eventName };
  const icsUrl = `${siteBase(request)}/api/venue-bookings/ics?token=${row.public_token}`;
  const googleUrl = googleCalendarUrl(calendar);
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
  const { error: logError } = await sb
    .from("venue_bookings")
    .update({ metadata: { ...booking.metadata, emails: log } })
    .eq("id", booking.id);
  if (logError) console.error("[venue-bookings.notify] log", logError.message);

  const ok = sent.some((s) => s.status === "sent");
  const off = sent.every((s) => s.status === "off");
  return NextResponse.json({
    ok,
    sent,
    error: ok ? "" : off ? "Booking emails are switched off in Notifications." : sent.find((s) => s.error)?.error || "Couldn't send.",
  });
}
