import { adminClient } from "@/lib/supabase/admin";
import { sendNotificationEmail } from "@/lib/email/notifications";
import { listMemberPushTokens, sendExpoPush } from "@/lib/portal/push";
import { fmtSlot, safeZone, tzAbbrev } from "./time";

// Server-only: emails and push notices for meeting requests and meetings. Every send is best-effort and never throws.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public app URL for links in mail: the configured public URL, else this request's origin + basePath.
export function publicBaseUrl(request) {
  try {
    const configured = process.env.GEIGER_OPERATIONS_PUBLIC_URL;
    const base = configured
      ? new URL(configured)
      : new URL(process.env.NEXT_PUBLIC_BASE_PATH || "/", new URL(request.url).origin);
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) return "";
    return base.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Flat, inline-styled transactional email (the suite API delivers pre-rendered HTML as-is).
export function renderMeetingEmail({ heading, paragraphs = [], rows = [], quote = "", cta = null, secondary = null, footer = "" }) {
  const p = (text) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1f2328">${esc(text)}</p>`;
  const table = rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 18px;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate">${rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;${i ? "border-top:1px solid #e5e7eb;" : ""}width:34%">${esc(k)}</td><td style="padding:10px 14px;font-size:14px;color:#111827;${i ? "border-top:1px solid #e5e7eb;" : ""}">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const quoteHtml = quote
    ? `<div style="margin:0 0 18px;padding:12px 14px;border-left:3px solid #d1d5db;background:#f9fafb;font-size:14px;line-height:1.5;color:#374151;white-space:pre-wrap">${esc(quote)}</div>`
    : "";
  const button = (b, primary) =>
    b?.url
      ? `<a href="${esc(b.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;${
          primary ? "background:#111827;color:#ffffff" : "background:#ffffff;color:#111827;border:1px solid #d1d5db"
        }">${esc(b.label)}</a>`
      : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 18px;font-size:13px;font-weight:600;color:#6b7280">Geiger Events</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827">${esc(heading)}</h1>
${paragraphs.filter(Boolean).map(p).join("")}${quoteHtml}${table}
<div style="margin:4px 0 12px">${button(cta, true)}${button(secondary, false)}</div>
</td></tr>
<tr><td style="padding:14px 28px 24px;border-top:1px solid #f0f0f0;font-size:12px;line-height:1.5;color:#9ca3af">${esc(
    footer || "You're receiving this because you're attending an event that uses Geiger Events networking.",
  )}</td></tr>
</table></td></tr></table></body></html>`;
}

async function loadEvent(sb, id) {
  const { data } = await sb
    .from("events")
    .select("id, name, event_date, timezone, venue, city, project_id")
    .eq("id", id)
    .maybeSingle();
  return data
    ? { id: data.id, name: data.name || "your event", tz: safeZone(data.timezone), venue: data.venue || "", city: data.city || "", projectId: data.project_id }
    : null;
}

// Contact + display details for members of one event (profile name first, then the portal account).
async function loadPeople(sb, eventId, ids) {
  const list = [...new Set((ids || []).filter((x) => UUID.test(String(x))))];
  if (!list.length) return new Map();
  const [{ data: members }, { data: profiles }] = await Promise.all([
    sb.from("portal_members").select("id, email, name").in("id", list),
    sb.from("meeting_profiles").select("member_id, display_name, company, title").eq("event_id", eventId).in("member_id", list),
  ]);
  const prof = new Map((profiles || []).map((p) => [p.member_id, p]));
  const out = new Map();
  for (const m of members || []) {
    const p = prof.get(m.id) || {};
    out.set(m.id, {
      id: m.id,
      email: m.email || "",
      name: (p.display_name || m.name || String(m.email || "").split("@")[0] || "An attendee").trim(),
      company: p.company || "",
      title: p.title || "",
    });
  }
  return out;
}

const who = (p) => [p?.name, [p?.title, p?.company].filter(Boolean).join(" at ")].filter(Boolean).join(", ");

async function push(memberIds, payload) {
  try {
    const tokens = await listMemberPushTokens(memberIds);
    if (tokens.length) await sendExpoPush(tokens, payload);
  } catch (e) {
    console.error("[meetings.notify.push]", e);
  }
}

function send({ event, notification, to, subject, html, data }) {
  if (!to?.email) return Promise.resolve({ ok: false, error: "no_email" });
  return sendNotificationEmail({
    projectId: event.projectId,
    notification,
    template: `events.${notification}`,
    to: to.email,
    subject,
    html,
    data,
  });
}

const portalLink = (base, eventId) => (base ? `${base}/members?tab=meetings&event=${eventId}` : "");
const icsLink = (base, token) => (base && token ? `${base}/api/portal/meetings/ics/${token}` : "");
const whereText = (meeting, event) =>
  [meeting.location_name, event.venue, event.city].filter(Boolean).join(", ") || "Shown in the portal";

async function requestReceived(sb, requestId, base) {
  const { data: r } = await sb.from("meeting_requests").select("*").eq("id", requestId).maybeSingle();
  if (!r) return;
  const event = await loadEvent(sb, r.event_id);
  if (!event) return;
  const people = await loadPeople(sb, r.event_id, [r.from_member, r.to_member]);
  const from = people.get(r.from_member);
  const to = people.get(r.to_member);
  const slots = (Array.isArray(r.proposed_slots) ? r.proposed_slots : []).map((s) => fmtSlot(s.start, s.end, event.tz));
  const url = portalLink(base, event.id);
  await send({
    event,
    notification: "meeting_request_received",
    to,
    subject: `${from?.name || "Someone"} wants to meet at ${event.name}`,
    data: { recipientName: to?.name, requesterName: from?.name, eventName: event.name, message: r.message, slots, portalUrl: url },
    html: renderMeetingEmail({
      heading: `${from?.name || "Someone"} would like to meet you`,
      paragraphs: [
        `${who(from) || "An attendee"} sent you a meeting request for ${event.name}.`,
        slots.length ? `Times they suggested (${tzAbbrev(event.tz)}):` : "",
      ],
      rows: slots.map((s, i) => [`Option ${i + 1}`, s]),
      quote: r.message || "",
      cta: url ? { label: "Accept or decline", url } : null,
    }),
  });
  await push([r.to_member], {
    title: "New meeting request",
    body: `${from?.name || "Someone"} wants to meet at ${event.name}`,
    data: { type: "meeting_request", eventId: event.id, requestId: r.id },
  });
}

async function requestDeclined(sb, requestId, base) {
  const { data: r } = await sb.from("meeting_requests").select("*").eq("id", requestId).maybeSingle();
  if (!r || r.status !== "declined") return;
  const event = await loadEvent(sb, r.event_id);
  if (!event) return;
  const people = await loadPeople(sb, r.event_id, [r.from_member, r.to_member]);
  const from = people.get(r.from_member);
  const to = people.get(r.to_member);
  const url = portalLink(base, event.id);
  await send({
    event,
    notification: "meeting_request_declined",
    to: from,
    subject: `${to?.name || "Your contact"} can't meet at ${event.name}`,
    data: { recipientName: from?.name, otherName: to?.name, eventName: event.name, note: r.decline_note, portalUrl: url },
    html: renderMeetingEmail({
      heading: `${to?.name || "Your contact"} declined your meeting request`,
      paragraphs: [
        `${to?.name || "They"} can't meet during ${event.name}.`,
        "There are plenty of other people to meet — browse the directory to send another request.",
      ],
      quote: r.decline_note || "",
      cta: url ? { label: "Browse attendees", url } : null,
    }),
  });
  await push([r.from_member], {
    title: "Meeting request declined",
    body: `${to?.name || "Your contact"} can't meet at ${event.name}`,
    data: { type: "meeting_declined", eventId: event.id, requestId: r.id },
  });
}

// confirmed | cancelled | rescheduled — sent to every participant except the one who made the change.
async function meetingNotice(sb, kind, meetingId, actorMemberId, base) {
  const { data: m } = await sb.from("meetings").select("*").eq("id", meetingId).maybeSingle();
  if (!m) return;
  const event = await loadEvent(sb, m.event_id);
  if (!event) return;
  const people = await loadPeople(sb, m.event_id, m.participants);
  const when = fmtSlot(m.starts_at, m.ends_at, event.tz);
  const url = portalLink(base, event.id);
  const ics = icsLink(base, m.calendar_token);
  const recipients = (m.participants || []).filter((id) => id !== actorMemberId);

  for (const id of recipients) {
    const to = people.get(id);
    const others = (m.participants || []).filter((x) => x !== id).map((x) => people.get(x)).filter(Boolean);
    const otherName = others.map((o) => o.name).join(" & ") || "your contact";
    const rows = [
      ["With", others.map(who).join("; ") || otherName],
      ["When", `${when} (${tzAbbrev(event.tz, new Date(m.starts_at))})`],
      ["Where", whereText(m, event)],
      ["Event", event.name],
    ];
    if (kind === "confirmed") {
      await send({
        event,
        notification: "meeting_request_accepted",
        to,
        subject: `Meeting confirmed with ${otherName}`,
        data: { recipientName: to?.name, otherName, eventName: event.name, when, location: m.location_name, calendarUrl: ics, portalUrl: url },
        html: renderMeetingEmail({
          heading: `You're meeting ${otherName}`,
          paragraphs: [`Your meeting at ${event.name} is booked.`],
          rows,
          cta: ics ? { label: "Add to calendar", url: ics } : null,
          secondary: url ? { label: "View my meetings", url } : null,
        }),
      });
    } else if (kind === "cancelled") {
      const by = m.cancelled_by === "organiser" ? "The organiser" : otherName;
      await send({
        event,
        notification: "meeting_cancelled",
        to,
        subject: `Meeting with ${otherName} cancelled`,
        data: { recipientName: to?.name, otherName, eventName: event.name, when, reason: m.cancel_reason, portalUrl: url },
        html: renderMeetingEmail({
          heading: `Your meeting with ${otherName} was cancelled`,
          paragraphs: [`${by} cancelled this meeting. The time is free again in your schedule.`],
          rows,
          quote: m.cancel_reason || "",
          cta: url ? { label: "Find another time", url } : null,
        }),
      });
    } else if (kind === "rescheduled") {
      await send({
        event,
        notification: "meeting_rescheduled",
        to,
        subject: `Meeting with ${otherName} moved`,
        data: { recipientName: to?.name, otherName, eventName: event.name, when, location: m.location_name, calendarUrl: ics, portalUrl: url },
        html: renderMeetingEmail({
          heading: `Your meeting with ${otherName} has moved`,
          paragraphs: ["The organiser moved this meeting. Here are the new details."],
          rows,
          cta: ics ? { label: "Update my calendar", url: ics } : null,
          secondary: url ? { label: "View my meetings", url } : null,
        }),
      });
    }
  }

  const titles = { confirmed: "Meeting confirmed", cancelled: "Meeting cancelled", rescheduled: "Meeting moved" };
  if (recipients.length && titles[kind]) {
    await push(recipients, {
      title: titles[kind],
      body: `${when} · ${event.name}`,
      data: { type: `meeting_${kind}`, eventId: event.id, meetingId: m.id },
    });
  }
}

// notice: { kind: request_received | request_declined | meeting_confirmed | meeting_cancelled | meeting_rescheduled, requestId?, meetingId?, actorMemberId? }
export async function runMeetingNotice(notice, { baseUrl = "" } = {}) {
  const sb = adminClient();
  if (!sb || !notice?.kind) return;
  try {
    if (notice.kind === "request_received") await requestReceived(sb, notice.requestId, baseUrl);
    else if (notice.kind === "request_declined") await requestDeclined(sb, notice.requestId, baseUrl);
    else if (notice.kind.startsWith("meeting_")) {
      await meetingNotice(sb, notice.kind.slice(8), notice.meetingId, notice.actorMemberId || null, baseUrl);
    }
  } catch (e) {
    console.error(`[meetings.notify] ${notice.kind}`, e);
  }
}
