// Calendar exports for a venue booking: an .ics file and a Google Calendar link, both in UTC.

import { setupStyleLabel } from "./styles.js";

const pad = (n) => String(n).padStart(2, "0");

function utcStamp(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

const esc = (v) =>
  String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// RFC 5545 lines must fold at 75 octets.
function fold(line) {
  if (line.length <= 74) return line;
  const out = [line.slice(0, 74)];
  for (let i = 74; i < line.length; i += 73) out.push(` ${line.slice(i, i + 73)}`);
  return out.join("\r\n");
}

export function bookingSummary({ booking, spaceName, venueName }) {
  const what = booking?.title || "Venue booking";
  return `${what} · ${[spaceName, venueName].filter(Boolean).join(", ")}`;
}

function bookingDescription({ booking, eventName }) {
  return [
    `Reference: ${booking?.reference || ""}`,
    booking?.status === "hold" ? "Provisional hold — not yet confirmed." : "",
    eventName ? `Event: ${eventName}` : "",
    booking?.setupStyle ? `Setup: ${setupStyleLabel(booking.setupStyle)}${booking.attendees ? ` for ${booking.attendees}` : ""}` : "",
    booking?.notes ? `Notes: ${booking.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildBookingIcs({ booking, spaceName = "", venueName = "", address = "", eventName = "" }) {
  if (!booking?.startsAt || !booking?.endsAt) return "";
  const cancelled = booking.status === "cancelled";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Geiger Events//Instant Book//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${booking.id}@geiger-events`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(booking.startsAt)}`,
    `DTEND:${utcStamp(booking.endsAt)}`,
    `SUMMARY:${esc(bookingSummary({ booking, spaceName, venueName }))}`,
    `LOCATION:${esc([spaceName, venueName, address].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc(bookingDescription({ booking, eventName }))}`,
    `STATUS:${cancelled ? "CANCELLED" : booking.status === "hold" ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n");
}

export function googleCalendarUrl({ booking, spaceName = "", venueName = "", address = "", eventName = "" }) {
  if (!booking?.startsAt || !booking?.endsAt) return "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: bookingSummary({ booking, spaceName, venueName }),
    dates: `${utcStamp(booking.startsAt)}/${utcStamp(booking.endsAt)}`,
    details: bookingDescription({ booking, eventName }),
    location: [spaceName, venueName, address].filter(Boolean).join(", "),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsFileName(booking) {
  return `${String(booking?.reference || "booking").replace(/[^A-Za-z0-9-]/g, "")}.ics`;
}
