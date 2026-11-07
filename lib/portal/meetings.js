import { adminClient } from "@/lib/supabase/admin";
import {
  MAX_PENDING_OUTGOING,
  MAX_PROPOSED_SLOTS,
  bookingWindowState,
  canNetwork,
  cleanTags,
  isListedProfile,
  normalizeSettingsRow,
} from "@/lib/meetings/settings";
import { blockedIntervals, busyFor, findSlot, mutualSlots } from "@/lib/meetings/slots";
import { fmtSlot, safeZone } from "@/lib/meetings/time";
import { buildMeetingIcs, icsFilename } from "@/lib/meetings/ics";
import { meetingErrorMessage } from "@/lib/meetings/errors";

// Server-only: the members-portal side of the Meeting Scheduler. Every read/write goes through the service role,
// scoped here to events the member holds a valid ticket for, and to their own requests and meetings.
// Functions return data, or { error, status } for the route to send back.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{32}$/i;

const fail = (error, status = 400) => ({ error, status });
const arr = (v) => (Array.isArray(v) ? v : []);
const text = (v, max) => String(v ?? "").trim().slice(0, max);
// Exact, case-insensitive email match: escape LIKE wildcards (an "_" is common in addresses).
const emailPattern = (email) => String(email || "").trim().replace(/[\\%_]/g, (c) => `\\${c}`);

const WINDOW_MESSAGES = {
  off: "Networking isn't open for this event.",
  not_open: "Meeting requests haven't opened yet.",
  closed: "Meeting requests have closed for this event.",
};

function validOrder(o) {
  if (o.cancelled_at) return false;
  if (["cancelled", "refunded"].includes(o.status || "confirmed")) return false;
  return !(Number(o.total) > 0 && Number(o.refunded_total || 0) >= Number(o.total));
}

async function holdsTicket(sb, eventId, email) {
  if (!email) return false;
  const { data, error } = await sb
    .from("event_orders")
    .select("id, status, cancelled_at, total, refunded_total")
    .eq("event_id", eventId)
    .ilike("buyer_email", emailPattern(email));
  if (error) {
    console.error("[portal.meetings.ticket]", error.message);
    return false;
  }
  return (data || []).some(validOrder);
}

function mapEvent(e) {
  return {
    id: e.id,
    name: e.name || "Event",
    date: e.event_date || "",
    time: e.event_time || "",
    timezone: safeZone(e.timezone),
    venue: e.venue || "",
    city: e.city || "",
    coverUrl: e.cover_url || "",
    projectId: e.project_id,
  };
}

const EVENT_COLS = "id, name, event_date, event_time, timezone, venue, city, cover_url, project_id";

function mapProfile(row, { own = false } = {}) {
  const base = {
    memberId: row.member_id,
    hasProfile: true,
    optedIn: Boolean(row.opted_in),
    role: row.role || "attendee",
    name: row.display_name || "",
    company: row.company || "",
    title: row.title || "",
    bio: row.bio || "",
    interests: arr(row.interests),
    lookingFor: arr(row.looking_for),
    avatarUrl: row.avatar_url || "",
    hidden: Boolean(row.hidden),
  };
  return own ? { ...base, id: row.id, blockedSlots: arr(row.blocked_slots) } : base;
}

function emptyProfile(member) {
  return {
    memberId: member.id,
    hasProfile: false,
    optedIn: false,
    role: "attendee",
    name: member.name || "",
    company: "",
    title: "",
    bio: "",
    interests: [],
    lookingFor: [],
    avatarUrl: "",
    hidden: false,
    blockedSlots: [],
  };
}

const publicPerson = (p) => ({
  memberId: p.memberId,
  name: p.name || "Attendee",
  company: p.company,
  title: p.title,
  bio: p.bio,
  interests: p.interests,
  lookingFor: p.lookingFor,
  avatarUrl: p.avatarUrl,
  role: p.role,
});

function mapMeetingRow(m) {
  return {
    id: m.id,
    participants: arr(m.participants),
    startsAt: m.starts_at,
    endsAt: m.ends_at,
    locationId: m.location_id || null,
    status: m.status,
  };
}

// Display cards for other members of the event (profile first, then their portal account name).
async function peopleById(sb, eventId, ids) {
  const list = [...new Set(arr(ids).filter((x) => UUID.test(String(x))))];
  if (!list.length) return new Map();
  const [{ data: members }, { data: profiles }] = await Promise.all([
    sb.from("portal_members").select("id, name, email").in("id", list),
    sb.from("meeting_profiles").select("*").eq("event_id", eventId).in("member_id", list),
  ]);
  const prof = new Map((profiles || []).map((p) => [p.member_id, mapProfile(p)]));
  const out = new Map();
  for (const m of members || []) {
    const p = prof.get(m.id);
    out.set(
      m.id,
      publicPerson({
        ...(p || emptyProfile(m)),
        name: p?.name || m.name || String(m.email || "").split("@")[0] || "Attendee",
      }),
    );
  }
  return out;
}

async function loadSessions(sb, event) {
  const { data, error } = await sb
    .from("conference_records")
    .select("status, starts_at, ends_at, config")
    .eq("project_id", event.projectId)
    .eq("module", "session")
    .eq("config->>eventId", event.id)
    .is("deleted_at", null);
  if (error) {
    console.error("[portal.meetings.sessions]", error.message);
    return [];
  }
  return (data || []).map((s) => ({
    status: s.status,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    config: s.config && typeof s.config === "object" ? s.config : {},
  }));
}

async function eventMeetings(sb, eventId) {
  const { data } = await sb
    .from("meetings")
    .select("id, participants, starts_at, ends_at, location_id, status")
    .eq("event_id", eventId)
    .eq("status", "scheduled")
    .is("deleted_at", null);
  return (data || []).map(mapMeetingRow);
}

// Pending requests whose last slot (or the booking window) has passed lapse to expired.
async function expireRequests(sb, eventId) {
  const { error } = await sb
    .from("meeting_requests")
    .update({ status: "expired" })
    .eq("event_id", eventId)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
  if (error) console.error("[portal.meetings.expire]", error.message);
}

// Event + settings + the member's own profile, after checking they hold a valid ticket.
async function loadContext(member, eventId, { requireEnabled = true } = {}) {
  const sb = adminClient();
  if (!sb) return fail("Unavailable.", 503);
  if (!member?.id || !UUID.test(String(eventId || ""))) return fail("Event not found.", 404);
  const [{ data: eventRow }, holds] = await Promise.all([
    sb.from("events").select(EVENT_COLS).eq("id", eventId).is("deleted_at", null).maybeSingle(),
    holdsTicket(sb, eventId, member.email),
  ]);
  if (!eventRow) return fail("Event not found.", 404);
  if (!holds) return fail("You need a ticket to this event to use its networking.", 403);
  const event = mapEvent(eventRow);
  const [{ data: settingsRow }, { data: profileRow }] = await Promise.all([
    sb.from("meeting_settings").select("*").eq("event_id", eventId).is("deleted_at", null).maybeSingle(),
    sb.from("meeting_profiles").select("*").eq("event_id", eventId).eq("member_id", member.id).is("deleted_at", null).maybeSingle(),
  ]);
  const settings = normalizeSettingsRow(settingsRow, event);
  if (requireEnabled && !settings.enabled) return fail(WINDOW_MESSAGES.off, 404);
  const profile = profileRow ? mapProfile(profileRow, { own: true }) : emptyProfile(member);
  return { sb, event, settings, profile, tz: event.timezone };
}

function publicSettings(s) {
  return {
    slotMinutes: s.slotMinutes,
    bufferMinutes: s.bufferMinutes,
    days: s.days,
    maxMeetings: s.maxMeetings,
    requestScope: s.requestScope,
    requireAcceptance: s.requireAcceptance,
    messageMaxLength: s.messageMaxLength,
    opensAt: s.opensAt,
    closesAt: s.closesAt,
    locations: s.locations.map((l) => ({ id: l.id, name: l.name })),
  };
}

// Events the member holds a ticket for whose networking is switched on.
export async function listMeetingEvents(member) {
  const sb = adminClient();
  if (!sb || !member?.email) return [];
  const { data: orders, error } = await sb
    .from("event_orders")
    .select("event_id, status, cancelled_at, total, refunded_total")
    .ilike("buyer_email", emailPattern(member.email));
  if (error) {
    console.error("[portal.meetings.events]", error.message);
    return [];
  }
  const eventIds = [...new Set((orders || []).filter(validOrder).map((o) => o.event_id).filter(Boolean))];
  if (!eventIds.length) return [];
  const { data: settingsRows } = await sb
    .from("meeting_settings")
    .select("*")
    .in("event_id", eventIds)
    .eq("enabled", true)
    .is("deleted_at", null);
  const enabledIds = (settingsRows || []).map((s) => s.event_id);
  if (!enabledIds.length) return [];
  const now = new Date().toISOString();
  const [{ data: events }, { data: profiles }, { data: incoming }, { data: meetings }] = await Promise.all([
    sb.from("events").select(EVENT_COLS).in("id", enabledIds).is("deleted_at", null),
    sb.from("meeting_profiles").select("event_id, opted_in").eq("member_id", member.id).in("event_id", enabledIds),
    sb.from("meeting_requests").select("event_id").eq("to_member", member.id).eq("status", "pending").gt("expires_at", now).in("event_id", enabledIds).is("deleted_at", null),
    sb.from("meetings").select("event_id").contains("participants", [member.id]).eq("status", "scheduled").gt("ends_at", now).in("event_id", enabledIds).is("deleted_at", null),
  ]);
  const countBy = (rows) => (rows || []).reduce((acc, r) => ({ ...acc, [r.event_id]: (acc[r.event_id] || 0) + 1 }), {});
  const pending = countBy(incoming);
  const upcoming = countBy(meetings);
  const optedIn = Object.fromEntries((profiles || []).map((p) => [p.event_id, Boolean(p.opted_in)]));
  const settingsBy = Object.fromEntries((settingsRows || []).map((s) => [s.event_id, s]));
  return (events || [])
    .map((e) => {
      const event = mapEvent(e);
      const settings = normalizeSettingsRow(settingsBy[e.id], event);
      return {
        ...event,
        optedIn: Boolean(optedIn[e.id]),
        pendingIncoming: pending[e.id] || 0,
        upcomingMeetings: upcoming[e.id] || 0,
        window: bookingWindowState(settings),
      };
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Everything the attendee's networking screen needs for one event, minus the directory.
export async function getMeetingState(member, eventId) {
  const ctx = await loadContext(member, eventId);
  if (ctx.error) return ctx;
  const { sb, event, settings, profile } = ctx;
  await expireRequests(sb, eventId);
  const [{ data: requests }, { data: meetings }] = await Promise.all([
    sb
      .from("meeting_requests")
      .select("*")
      .eq("event_id", eventId)
      .or(`from_member.eq.${member.id},to_member.eq.${member.id}`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
    sb
      .from("meetings")
      .select("*")
      .eq("event_id", eventId)
      .contains("participants", [member.id])
      .is("deleted_at", null)
      .order("starts_at", { ascending: true }),
  ]);
  const otherIds = [
    ...(requests || []).map((r) => (r.from_member === member.id ? r.to_member : r.from_member)),
    ...(meetings || []).flatMap((m) => arr(m.participants)),
  ].filter((id) => id !== member.id);
  const people = await peopleById(sb, eventId, otherIds);
  const fallback = (id) => ({ memberId: id, name: "Attendee", company: "", title: "", interests: [], lookingFor: [], avatarUrl: "", role: "attendee", bio: "" });

  return {
    event,
    settings: publicSettings(settings),
    window: bookingWindowState(settings),
    profile,
    canNetwork: canNetwork(profile, settings.requestScope),
    requests: (requests || []).map((r) => {
      const incoming = r.to_member === member.id;
      const otherId = incoming ? r.from_member : r.to_member;
      return {
        id: r.id,
        direction: incoming ? "incoming" : "outgoing",
        status: r.status,
        message: r.message || "",
        declineNote: r.decline_note || "",
        proposedSlots: arr(r.proposed_slots),
        respondedAt: r.responded_at,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
        cancelledBy: r.cancelled_by || null,
        other: people.get(otherId) || fallback(otherId),
      };
    }),
    meetings: (meetings || []).map((m) => ({
      id: m.id,
      requestId: m.request_id,
      startsAt: m.starts_at,
      endsAt: m.ends_at,
      status: m.status,
      locationName: m.location_name || "",
      cancelReason: m.cancel_reason || "",
      cancelledBy: m.cancelled_by || null,
      cancelledByMe: m.cancelled_member === member.id,
      rescheduledAt: m.rescheduled_at,
      calendarToken: m.calendar_token,
      bookedByOrganiser: !m.request_id,
      others: arr(m.participants)
        .filter((id) => id !== member.id)
        .map((id) => people.get(id) || fallback(id)),
    })),
  };
}

// The directory population for this viewer, honouring the event's request scope and moderation.
async function directoryPeople(ctx, member) {
  const { sb, event, settings, profile } = ctx;
  const [{ data: holders, error }, { data: profileRows }] = await Promise.all([
    sb.rpc("meeting_attendees", { p_event: event.id }),
    sb.from("meeting_profiles").select("*").eq("event_id", event.id).is("deleted_at", null),
  ]);
  if (error) {
    console.error("[portal.meetings.attendees]", error.message);
    return [];
  }
  const profiles = new Map((profileRows || []).map((p) => [p.member_id, mapProfile(p)]));
  const scope = settings.requestScope;
  const viewerIsExhibitor = profile.role === "exhibitor" && profile.optedIn;
  const out = [];
  for (const h of holders || []) {
    if (h.member_id === member.id) continue;
    const p = profiles.get(h.member_id) || { ...emptyProfile({ id: h.member_id, name: h.name }) };
    const person = { ...p, name: p.name || h.name || "Attendee" };
    if (isListedProfile(person, { scope, viewerIsExhibitor })) out.push(person);
  }
  return out;
}

// Check that a member can be requested by this viewer; returns their listing or an error.
async function resolveTarget(ctx, member, targetId) {
  if (!UUID.test(String(targetId || "")) || targetId === member.id) return fail("Pick someone to meet.", 400);
  const { sb, event, settings, profile } = ctx;
  const [{ data: target }, { data: targetProfile }] = await Promise.all([
    sb.from("portal_members").select("id, name, email").eq("id", targetId).maybeSingle(),
    sb.from("meeting_profiles").select("*").eq("event_id", event.id).eq("member_id", targetId).is("deleted_at", null).maybeSingle(),
  ]);
  if (!target || !(await holdsTicket(sb, event.id, target.email))) return fail("That attendee isn't available.", 404);
  const person = targetProfile ? mapProfile(targetProfile, { own: true }) : emptyProfile(target);
  const listed = isListedProfile(person, {
    scope: settings.requestScope,
    viewerIsExhibitor: profile.role === "exhibitor" && profile.optedIn,
  });
  if (!listed) return fail("That attendee isn't taking meeting requests.", 404);
  return { target: { ...person, name: person.name || target.name || "Attendee" } };
}

// Mutually free slots between the member and another attendee.
async function computeMutual(ctx, member, target) {
  const { sb, event, settings, profile, tz } = ctx;
  const [meetings, sessions] = await Promise.all([eventMeetings(sb, event.id), loadSessions(sb, event)]);
  return mutualSlots({
    settings,
    tz,
    sessions,
    eventMeetings: meetings,
    people: [
      { busy: busyFor(meetings, member.id), blocked: blockedIntervals(profile.blockedSlots) },
      { busy: busyFor(meetings, target.memberId), blocked: blockedIntervals(target.blockedSlots) },
    ],
  });
}

export async function listDirectory(member, eventId) {
  const ctx = await loadContext(member, eventId);
  if (ctx.error) return ctx;
  const { sb } = ctx;
  const [people, { data: pending }, { data: meetings }] = await Promise.all([
    directoryPeople(ctx, member),
    sb
      .from("meeting_requests")
      .select("from_member, to_member")
      .eq("event_id", eventId)
      .eq("status", "pending")
      .or(`from_member.eq.${member.id},to_member.eq.${member.id}`)
      .is("deleted_at", null),
    sb
      .from("meetings")
      .select("participants")
      .eq("event_id", eventId)
      .eq("status", "scheduled")
      .contains("participants", [member.id])
      .is("deleted_at", null),
  ]);
  const relation = new Map();
  for (const r of pending || []) {
    if (r.from_member === member.id) relation.set(r.to_member, "requested");
    else relation.set(r.from_member, "incoming");
  }
  for (const m of meetings || []) for (const id of arr(m.participants)) if (id !== member.id) relation.set(id, "meeting");
  return {
    people: people
      .map((p) => ({ ...publicPerson(p), relation: relation.get(p.memberId) || null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// Opt in/out and edit the member's networking profile and unavailable slots.
export async function saveMeetingProfile(member, eventId, input) {
  const ctx = await loadContext(member, eventId);
  if (ctx.error) return ctx;
  const { sb, event, settings, tz, profile } = ctx;
  if (profile.hidden && input?.optedIn) return fail("The organiser has paused your networking profile.", 403);
  const avatar = text(input?.avatarUrl, 500);
  if (avatar && !/^https:\/\//i.test(avatar)) return fail("Use an https:// link for your photo.", 400);
  const blocked = [];
  const seen = new Set();
  for (const s of arr(input?.blockedSlots).slice(0, 400)) {
    const slot = findSlot(settings, tz, s?.start, s?.end);
    if (slot && !seen.has(slot.key)) {
      seen.add(slot.key);
      blocked.push({ start: slot.start, end: slot.end });
    }
  }
  const row = {
    project_id: event.projectId,
    event_id: event.id,
    member_id: member.id,
    email: member.email || "",
    opted_in: Boolean(input?.optedIn),
    display_name: text(input?.name, 80) || member.name || "",
    company: text(input?.company, 120),
    title: text(input?.title, 120),
    bio: text(input?.bio, 1000),
    interests: cleanTags(input?.interests),
    looking_for: cleanTags(input?.lookingFor),
    avatar_url: avatar || null,
    blocked_slots: blocked,
    deleted_at: null,
  };
  const { data, error } = await sb
    .from("meeting_profiles")
    .upsert(row, { onConflict: "event_id,member_id" })
    .select("*")
    .single();
  if (error) {
    console.error("[portal.meetings.profile]", error.message);
    return fail("Couldn't save your profile.", 500);
  }
  const saved = mapProfile(data, { own: true });
  return { profile: saved, canNetwork: canNetwork(saved, settings.requestScope) };
}

export async function slotsWith(member, eventId, targetId) {
  const ctx = await loadContext(member, eventId);
  if (ctx.error) return ctx;
  const resolved = await resolveTarget(ctx, member, targetId);
  if (resolved.error) return resolved;
  const slots = await computeMutual(ctx, member, resolved.target);
  return { slots: slots.map(({ key, date, start, end }) => ({ key, date, start, end })) };
}

export async function createMeetingRequest(member, eventId, input) {
  const ctx = await loadContext(member, eventId);
  if (ctx.error) return ctx;
  const { sb, event, settings, profile, tz } = ctx;
  const window = bookingWindowState(settings);
  if (window !== "open") return fail(WINDOW_MESSAGES[window], 409);
  if (!canNetwork(profile, settings.requestScope)) {
    return fail("Turn on networking in your profile before sending requests.", 403);
  }
  const resolved = await resolveTarget(ctx, member, input?.toMemberId);
  if (resolved.error) return resolved;
  const target = resolved.target;

  const message = text(input?.message, 4000);
  if (message.length > settings.messageMaxLength) {
    return fail(
      settings.messageMaxLength
        ? `Keep your message under ${settings.messageMaxLength} characters.`
        : "Messages are turned off for this event.",
      400,
    );
  }
  const wanted = [...new Set(arr(input?.slots).map((s) => `${s?.start}|${s?.end}`))].slice(0, MAX_PROPOSED_SLOTS + 1);
  if (!wanted.length) return fail("Pick at least one time.", 400);
  if (wanted.length > MAX_PROPOSED_SLOTS) return fail(`Suggest up to ${MAX_PROPOSED_SLOTS} times.`, 400);

  const [{ data: open }, { data: together }, { count: outgoing }, { count: mine }] = await Promise.all([
    sb
      .from("meeting_requests")
      .select("id, from_member")
      .eq("event_id", eventId)
      .eq("status", "pending")
      .or(`and(from_member.eq.${member.id},to_member.eq.${target.memberId}),and(from_member.eq.${target.memberId},to_member.eq.${member.id})`)
      .is("deleted_at", null),
    sb
      .from("meetings")
      .select("id")
      .eq("event_id", eventId)
      .eq("status", "scheduled")
      .contains("participants", [member.id, target.memberId])
      .is("deleted_at", null),
    sb
      .from("meeting_requests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("from_member", member.id)
      .eq("status", "pending")
      .is("deleted_at", null),
    sb
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "scheduled")
      .contains("participants", [member.id])
      .is("deleted_at", null),
  ]);
  if ((open || []).some((r) => r.from_member === target.memberId)) {
    return fail(`${target.name} already asked to meet you — answer it under Requests.`, 409);
  }
  if ((open || []).length) return fail(`You've already sent ${target.name} a request.`, 409);
  if ((together || []).length) return fail(`You already have a meeting with ${target.name}.`, 409);
  if ((outgoing || 0) >= MAX_PENDING_OUTGOING) {
    return fail("You have too many requests waiting for an answer. Give people a chance to reply first.", 429);
  }
  if (settings.maxMeetings && (mine || 0) >= settings.maxMeetings) {
    return fail(`You've reached the limit of ${settings.maxMeetings} meetings for this event.`, 409);
  }

  const free = new Map((await computeMutual(ctx, member, target)).map((s) => [`${s.start}|${s.end}`, s]));
  const slots = [];
  for (const key of wanted) {
    const [start, end] = key.split("|");
    const slot = findSlot(settings, tz, start, end);
    const freeSlot = slot && free.get(`${slot.start}|${slot.end}`);
    if (!freeSlot) return fail("One of those times is no longer free for both of you. Pick again.", 409);
    slots.push({ start: freeSlot.start, end: freeSlot.end });
  }
  slots.sort((a, b) => a.start.localeCompare(b.start));
  const lastEnd = slots[slots.length - 1].end;
  const expiresAt =
    settings.closesAt && new Date(settings.closesAt) < new Date(lastEnd) ? settings.closesAt : lastEnd;

  const { data: request, error } = await sb
    .from("meeting_requests")
    .insert({
      project_id: event.projectId,
      event_id: event.id,
      from_member: member.id,
      to_member: target.memberId,
      proposed_slots: slots,
      message,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return fail(`You've already sent ${target.name} a request.`, 409);
    console.error("[portal.meetings.request]", error.message);
    return fail("Couldn't send your request.", 500);
  }

  // Instant booking: the first suggested time is booked straight away.
  if (!settings.requireAcceptance) {
    const { data: meetingId, error: bookError } = await sb.rpc("accept_meeting_request", {
      p_request: request.id,
      p_member: target.memberId,
      p_starts: slots[0].start,
      p_ends: slots[0].end,
    });
    if (!bookError && meetingId) {
      return { requestId: request.id, meetingId, booked: true, notice: { kind: "meeting_confirmed", meetingId } };
    }
    console.error("[portal.meetings.autobook]", bookError?.message);
  }
  return { requestId: request.id, booked: false, notice: { kind: "request_received", requestId: request.id } };
}

export async function respondToRequest(member, eventId, requestId, input) {
  const ctx = await loadContext(member, eventId);
  if (ctx.error) return ctx;
  const { sb, settings, tz, event } = ctx;
  if (!UUID.test(String(requestId || ""))) return fail("Request not found.", 404);
  const { data: r } = await sb
    .from("meeting_requests")
    .select("*")
    .eq("id", requestId)
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!r || (r.to_member !== member.id && r.from_member !== member.id)) return fail("Request not found.", 404);
  if (r.status !== "pending") return fail("This request has already been answered.", 409);
  const action = input?.action;

  if (action === "cancel") {
    if (r.from_member !== member.id) return fail("Only the sender can withdraw a request.", 403);
    const { data, error } = await sb
      .from("meeting_requests")
      .update({ status: "cancelled", cancelled_by: "sender", responded_at: new Date().toISOString() })
      .eq("id", r.id)
      .eq("status", "pending")
      .select("id");
    if (error || !data?.length) return fail("Couldn't withdraw the request.", 409);
    return { status: "cancelled" };
  }

  if (r.to_member !== member.id) return fail("Only the recipient can answer this request.", 403);

  if (action === "decline") {
    const { data, error } = await sb
      .from("meeting_requests")
      .update({ status: "declined", decline_note: text(input?.note, 500), responded_at: new Date().toISOString() })
      .eq("id", r.id)
      .eq("status", "pending")
      .select("id");
    if (error || !data?.length) return fail("Couldn't decline the request.", 409);
    return { status: "declined", notice: { kind: "request_declined", requestId: r.id } };
  }

  if (action === "accept") {
    const window = bookingWindowState(settings);
    if (window !== "open") return fail(WINDOW_MESSAGES[window], 409);
    const slot = findSlot(settings, tz, input?.start, input?.end);
    if (!slot) return fail("Pick one of the available times.", 400);
    const { data: fromProfile } = await sb
      .from("meeting_profiles")
      .select("*")
      .eq("event_id", event.id)
      .eq("member_id", r.from_member)
      .maybeSingle();
    const other = fromProfile ? mapProfile(fromProfile, { own: true }) : { memberId: r.from_member, blockedSlots: [] };
    const free = await computeMutual(ctx, member, other);
    if (!free.some((s) => s.start === slot.start && s.end === slot.end)) {
      return fail("That time is no longer free for both of you. Pick another.", 409);
    }
    const { data: meetingId, error } = await sb.rpc("accept_meeting_request", {
      p_request: r.id,
      p_member: member.id,
      p_starts: slot.start,
      p_ends: slot.end,
    });
    if (error) return fail(meetingErrorMessage(error, "Couldn't book the meeting."), 409);
    return {
      status: "accepted",
      meetingId,
      notice: { kind: "meeting_confirmed", meetingId, actorMemberId: member.id },
    };
  }

  return fail("Unknown action.", 400);
}

export async function cancelMemberMeeting(member, eventId, meetingId, reason) {
  const ctx = await loadContext(member, eventId, { requireEnabled: false });
  if (ctx.error) return ctx;
  const { sb } = ctx;
  if (!UUID.test(String(meetingId || ""))) return fail("Meeting not found.", 404);
  const { data: m } = await sb
    .from("meetings")
    .select("id, participants, status, starts_at")
    .eq("id", meetingId)
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!m || !arr(m.participants).includes(member.id)) return fail("Meeting not found.", 404);
  if (m.status !== "scheduled") return fail("This meeting isn't scheduled any more.", 409);
  if (new Date(m.starts_at) <= new Date()) return fail("This meeting has already started.", 409);
  const { data, error } = await sb
    .from("meetings")
    .update({
      status: "cancelled",
      cancelled_by: "member",
      cancelled_member: member.id,
      cancel_reason: text(reason, 500),
    })
    .eq("id", m.id)
    .eq("status", "scheduled")
    .select("id");
  if (error || !data?.length) return fail("Couldn't cancel the meeting.", 409);
  return { status: "cancelled", notice: { kind: "meeting_cancelled", meetingId: m.id, actorMemberId: member.id } };
}

// Calendar file for the emailed add-to-calendar link (the token is the bearer secret).
export async function meetingIcsByToken(token) {
  const sb = adminClient();
  if (!sb || !TOKEN.test(String(token || ""))) return null;
  const { data: m } = await sb
    .from("meetings")
    .select("*")
    .eq("calendar_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!m) return null;
  const { data: e } = await sb.from("events").select(EVENT_COLS).eq("id", m.event_id).maybeSingle();
  if (!e) return null;
  const event = mapEvent(e);
  const people = await peopleById(sb, m.event_id, m.participants);
  const names = arr(m.participants).map((id) => people.get(id)?.name).filter(Boolean);
  const title = `Meeting: ${names.join(" & ") || "Networking"} · ${event.name}`;
  const ics = buildMeetingIcs({
    id: m.id,
    startsAt: m.starts_at,
    endsAt: m.ends_at,
    status: m.status === "cancelled" ? "cancelled" : "scheduled",
    sequence: m.rescheduled_at ? Math.floor(new Date(m.rescheduled_at).getTime() / 1000) % 100000 : 0,
    title,
    location: [m.location_name, event.venue, event.city].filter(Boolean).join(", "),
    description: `1:1 meeting at ${event.name}. ${fmtSlot(m.starts_at, m.ends_at, event.timezone)}.`,
  });
  return ics ? { ics, filename: icsFilename(title) } : null;
}

// Meeting activity for the portal Notifications feed (newest first).
export async function listMeetingNotifications(email, seenAt) {
  const sb = adminClient();
  if (!sb || !email) return { items: [], unread: 0 };
  const { data: me } = await sb.from("portal_members").select("id").ilike("email", emailPattern(email)).maybeSingle();
  if (!me) return { items: [], unread: 0 };
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const [{ data: incoming }, { data: answered }, { data: meetings }] = await Promise.all([
    sb.from("meeting_requests").select("id, event_id, from_member, created_at").eq("to_member", me.id).gt("created_at", since).is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
    sb.from("meeting_requests").select("id, event_id, to_member, status, responded_at").eq("from_member", me.id).in("status", ["accepted", "declined"]).gt("responded_at", since).is("deleted_at", null).order("responded_at", { ascending: false }).limit(20),
    sb.from("meetings").select("id, event_id, participants, status, request_id, cancelled_member, created_by, rescheduled_at, starts_at, ends_at, updated_at, created_at").contains("participants", [me.id]).gt("updated_at", since).is("deleted_at", null).order("updated_at", { ascending: false }).limit(20),
  ]);
  const eventIds = [...new Set([...(incoming || []), ...(answered || []), ...(meetings || [])].map((r) => r.event_id))];
  if (!eventIds.length) return { items: [], unread: 0 };
  const { data: events } = await sb.from("events").select("id, name, timezone").in("id", eventIds);
  const eventBy = new Map((events || []).map((e) => [e.id, e]));
  const names = new Map();
  for (const eventId of eventIds) {
    const ids = [
      ...(incoming || []).filter((r) => r.event_id === eventId).map((r) => r.from_member),
      ...(answered || []).filter((r) => r.event_id === eventId).map((r) => r.to_member),
      ...(meetings || []).filter((r) => r.event_id === eventId).flatMap((r) => arr(r.participants)),
    ];
    for (const [id, p] of await peopleById(sb, eventId, ids)) names.set(id, p.name);
  }
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  const items = [];
  const add = (id, eventId, title, body, at) =>
    items.push({
      id,
      kind: "meeting",
      title,
      body,
      channel: "meetings",
      link: { tab: "meetings", eventId },
      createdAt: at,
      unread: at ? new Date(at).getTime() > seen : false,
    });
  for (const r of incoming || []) {
    add(`mr-${r.id}`, r.event_id, "New meeting request", `${names.get(r.from_member) || "Someone"} wants to meet · ${eventBy.get(r.event_id)?.name || "Event"}`, r.created_at);
  }
  for (const r of answered || []) {
    const who = names.get(r.to_member) || "Your contact";
    add(`ma-${r.id}`, r.event_id, r.status === "accepted" ? "Meeting request accepted" : "Meeting request declined", `${who} ${r.status === "accepted" ? "accepted" : "declined"} your request · ${eventBy.get(r.event_id)?.name || "Event"}`, r.responded_at);
  }
  for (const m of meetings || []) {
    const ev = eventBy.get(m.event_id);
    const when = fmtSlot(m.starts_at, m.ends_at, safeZone(ev?.timezone));
    const others = arr(m.participants).filter((id) => id !== me.id).map((id) => names.get(id) || "Attendee").join(" & ");
    if (m.status === "cancelled" && m.cancelled_member !== me.id) {
      add(`mc-${m.id}`, m.event_id, "Meeting cancelled", `With ${others} · ${when}`, m.updated_at);
    } else if (m.status === "scheduled" && m.rescheduled_at) {
      add(`mm-${m.id}`, m.event_id, "Meeting moved", `With ${others} · now ${when}`, m.rescheduled_at);
    } else if (m.status === "scheduled" && !m.request_id) {
      add(`mo-${m.id}`, m.event_id, "Meeting booked for you", `With ${others} · ${when}`, m.created_at);
    }
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { items, unread: items.filter((i) => i.unread).length };
}
