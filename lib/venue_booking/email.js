// Booking emails rendered here and delivered pre-rendered through the suite email API.
// kind: "confirmation" | "hold" | "cancellation"; role: "venue" (the venue contact) | "booker".

import { describeItem, formatMoney } from "./pricing.js";
import { setupStyleLabel } from "./styles.js";
import { formatInZone, formatRange, zoneAbbreviation } from "./time.js";

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const HEADINGS = {
  confirmation: { venue: "New confirmed booking", booker: "Your booking is confirmed" },
  hold: { venue: "Provisional hold placed", booker: "Your hold is in place" },
  cancellation: { venue: "Booking cancelled", booker: "Your booking was cancelled" },
};

function subjectFor(kind, ref, spaceName) {
  if (kind === "cancellation") return `Cancelled: ${spaceName} booking ${ref}`;
  if (kind === "hold") return `Provisional hold: ${spaceName} (${ref})`;
  return `Booking confirmed: ${spaceName} (${ref})`;
}

function introFor({ kind, role, recipientName, booking, spaceName, venueName, tz }) {
  const hi = `Hi ${esc(recipientName || "there")},`;
  const where = `<strong>${esc(spaceName)}</strong> at ${esc(venueName)}`;
  if (kind === "cancellation") {
    return `${hi}<br/><br/>The booking for ${where} has been cancelled${booking.cancelReason ? `: ${esc(booking.cancelReason)}` : "."} The time is free again.`;
  }
  if (kind === "hold") {
    const until = booking.holdExpiresAt
      ? formatInZone(booking.holdExpiresAt, tz, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      : "";
    return role === "venue"
      ? `${hi}<br/><br/>A provisional hold has been placed on ${where}. It is not confirmed yet${until ? ` and lapses on ${esc(until)} unless confirmed` : ""}.`
      : `${hi}<br/><br/>We've placed a provisional hold on ${where}${until ? `, held until ${esc(until)}` : ""}. Confirm it before then to keep the slot.`;
  }
  return role === "venue"
    ? `${hi}<br/><br/>${where} has been booked. The details are below.`
    : `${hi}<br/><br/>Your booking of ${where} is confirmed. The details are below.`;
}

function row(label, value) {
  if (!value) return "";
  return `<tr><td style="padding:6px 0;color:#6b6b6b;font-size:13px;width:140px;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;color:#111;font-size:13px">${value}</td></tr>`;
}

export function renderBookingEmail({
  kind = "confirmation",
  role = "booker",
  recipientName = "",
  booking,
  spaceName = "",
  venueName = "",
  venueAddress = "",
  eventName = "",
  timeZone = "UTC",
  icsUrl = "",
  googleUrl = "",
}) {
  const heading = HEADINGS[kind]?.[role] || HEADINGS.confirmation.booker;
  const ref = booking?.reference || "";
  const currency = booking?.currency || "GBP";
  const lines = Array.isArray(booking?.priceBreakdown?.lines) ? booking.priceBreakdown.lines : [];
  const when = `${formatRange(booking.startsAt, booking.endsAt, timeZone)} (${zoneAbbreviation(booking.startsAt, timeZone)})`;
  const setup = booking.setupStyle
    ? `${setupStyleLabel(booking.setupStyle)}${booking.attendees ? ` · ${booking.attendees} guests` : ""}`
    : booking.attendees
      ? `${booking.attendees} guests`
      : "";
  const contact = [booking.contactName, booking.contactEmail, booking.contactPhone].filter(Boolean).map(esc).join(" · ");

  const priceRows = lines
    .map((l) => {
      const items = (l.items || []).map((it) => esc(describeItem(it, currency))).join(", ") || "No charge";
      return `<tr><td style="padding:4px 0;color:#6b6b6b;font-size:12px">${esc(l.date)} · ${esc(items)}</td><td style="padding:4px 0;color:#111;font-size:12px;text-align:right">${esc(formatMoney(l.amount, currency))}</td></tr>`;
    })
    .join("");

  const calendarLinks =
    kind === "cancellation"
      ? ""
      : [icsUrl ? `<a href="${esc(icsUrl)}" style="color:#111">Add to calendar (.ics)</a>` : "", googleUrl ? `<a href="${esc(googleUrl)}" style="color:#111">Google Calendar</a>` : ""]
          .filter(Boolean)
          .join(" &nbsp;·&nbsp; ");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:28px">
<tr><td>
<p style="margin:0 0 4px;font-size:12px;color:#6b6b6b">Reference ${esc(ref)}</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#111">${esc(heading)}</h1>
<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#333">${introFor({ kind, role, recipientName, booking, spaceName, venueName, tz: timeZone })}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin-bottom:16px">
${row("Space", esc([spaceName, venueName].filter(Boolean).join(", ")))}
${row("Address", esc(venueAddress))}
${row("When", esc(when))}
${row("Booking", esc(booking.title))}
${row("Event", esc(eventName))}
${row("Setup", esc(setup))}
${row("Contact", contact)}
${row("Notes", esc(booking.notes).replace(/\n/g, "<br/>"))}
</table>
${
  lines.length && kind !== "cancellation"
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px">${priceRows}
<tr><td style="padding:8px 0 0;border-top:1px solid #eee;font-size:13px;font-weight:600;color:#111">Total</td><td style="padding:8px 0 0;border-top:1px solid #eee;font-size:13px;font-weight:600;color:#111;text-align:right">${esc(formatMoney(booking.total, currency))}</td></tr></table>`
    : ""
}
${calendarLinks ? `<p style="margin:16px 0 0;font-size:13px">${calendarLinks}</p>` : ""}
</td></tr></table>
<p style="margin:16px 0 0;font-size:11px;color:#9a9a9a">Sent by Geiger Events · Instant Book</p>
</td></tr></table>
</body></html>`;

  return { subject: subjectFor(kind, ref, spaceName || "Venue"), html };
}
