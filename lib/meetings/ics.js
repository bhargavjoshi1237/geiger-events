// iCalendar (.ics) for a booked meeting. Times are written in UTC so every calendar app places them correctly.

const esc = (v) =>
  String(v || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

const stamp = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
};

// meeting: { id, startsAt, endsAt, status, title, location, description, sequence }
export function buildMeetingIcs(meeting) {
  const start = stamp(meeting?.startsAt);
  const end = stamp(meeting?.endsAt);
  if (!start || !end) return "";
  const cancelled = meeting.status === "cancelled";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Geiger Events//Meetings//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:meeting-${meeting.id}@geiger-events`,
    `DTSTAMP:${stamp(new Date())}`,
    `SEQUENCE:${Number(meeting.sequence) || 0}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(meeting.title || "Meeting")}`,
    meeting.location ? `LOCATION:${esc(meeting.location)}` : null,
    meeting.description ? `DESCRIPTION:${esc(meeting.description)}` : null,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function icsFilename(title) {
  return `${String(title || "meeting").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "meeting"}.ics`;
}

export function downloadMeetingIcs(meeting) {
  const ics = buildMeetingIcs(meeting);
  if (!ics || typeof window === "undefined") return false;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = icsFilename(meeting.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
