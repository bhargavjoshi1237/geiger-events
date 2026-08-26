
function parseTime(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3] ? m[3].toLowerCase() : "";
  if (ap.startsWith("p") && h < 12) h += 12;
  if (ap.startsWith("a") && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function locationText(order) {
  return [order?.venue, order?.address, order?.city].filter(Boolean).join(", ");
}

export function directionsUrl(order) {
  const q = locationText(order);
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function buildEventICS(order) {
  if (!order?.eventDate) return "";
  const d = new Date(`${order.eventDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";

  const time = parseTime(order.eventTime);
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  let dtStart;
  let dtEnd;
  if (time) {
    dtStart = `DTSTART:${datePart}T${pad(time.h)}${pad(time.m)}00`;
    const end = new Date(d);
    end.setHours(time.h + 2, time.m, 0, 0);
    dtEnd = `DTEND:${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(
      end.getDate(),
    )}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  } else {
    dtStart = `DTSTART;VALUE=DATE:${datePart}`;
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    dtEnd = `DTEND;VALUE=DATE:${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(
      next.getDate(),
    )}`;
  }

  const esc = (v) =>
    String(v || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Geiger Events//Members Portal//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${order.id}@geiger-events`,
    dtStart,
    dtEnd,
    `SUMMARY:${esc(order.eventName)}`,
    `LOCATION:${esc(locationText(order))}`,
    `DESCRIPTION:${esc(`Your ticket: ${order.ticket || "Admission"} × ${order.quantity || 1} · ${order.orderCode || ""}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function downloadICS(order) {
  const ics = buildEventICS(order);
  if (!ics || typeof window === "undefined") return false;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(order.eventName || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
