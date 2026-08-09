import { adminClient } from "@/lib/supabase/admin";
import { loadMemberGrants } from "@/lib/portal/grants";
import { listMemberWatchlist } from "@/lib/portal/watch";
import { resolveItemGrant } from "@/lib/live/access";
import { resolveRoomState, isOpenToAttendees } from "@/lib/live/state";
import { presenceStatsByRoom } from "@/lib/live/presence";

// Server-only resolver for the portal's Live tab: which rooms a member may open
// right now. Mirrors lib/portal/watch.js — same membership loading and grant
// union — but over the room modules and with schedule-driven state applied.
// Fails closed: any read error yields [], never an unfiltered list.

const ROOM_MODULES = ["room", "webinar", "breakout"];

// Row statuses that mean "this unscheduled room is running" across the three
// room modules (room: Live, webinar: Live, breakout: Open).
const MANUAL_OPEN_STATUS = new Set(["Live", "Open"]);

const asObject = (v) => (v && typeof v === "object" ? v : {});

// The events a room is attached to — some carry many, most exactly one.
function itemEventIds(config) {
  const c = asObject(config);
  if (Array.isArray(c.eventIds)) return c.eventIds.filter(Boolean);
  return c.eventId ? [c.eventId] : [];
}

export async function listMemberRooms(email) {
  const sb = adminClient();
  if (!sb || !email) return [];

  const prepared = await loadMemberGrants(sb, email);
  if (!prepared) return [];
  const { grants, planIdsByProject, planExpiry, planName, events, projectIds } = prepared;

  const { data: items, error } = await sb
    .from("conference_records")
    .select(
      "id, module, name, status, cover_url, config, project_id, starts_at, ends_at",
    )
    .in("project_id", projectIds)
    .in("module", ROOM_MODULES)
    .is("deleted_at", null);
  if (error) {
    console.error("[portal.live.list]", error.message);
    return [];
  }

  const granted = [];
  for (const item of items || []) {
    const config = asObject(item.config);
    const eventIds = itemEventIds(config);
    const grant = resolveItemGrant({
      access: config.access,
      eventIds,
      projectId: item.project_id,
      grants,
      planIdsByProject,
      planExpiry,
      planName,
      events,
    });
    if (!grant.granted) continue;
    if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) continue;

    const state = resolveRoomState(
      { startsAt: item.starts_at, endsAt: item.ends_at, config },
      Date.now(),
    );
    // Ended rooms drop off the Live tab; their replay lives under Watch.
    if (state.state === "Ended") continue;

    granted.push({
      id: item.id,
      kind: item.module,
      name: item.name || "Untitled room",
      state: state.state,
      // A manual room has no schedule to open it, so the organiser's status leads.
      openNow:
        isOpenToAttendees(state.state) ||
        (state.state === "Manual" && MANUAL_OPEN_STATUS.has(item.status)),
      startsAt: item.starts_at,
      endsAt: item.ends_at,
      secondsUntilStart: state.secondsUntilStart,
      joinUrl: config.joinUrl || "",
      watchUrl: config.watchUrl || config.streamUrl || "",
      description: config.description || "",
      parentSessionId: config.parentSessionId || "",
      eventName: eventIds.map((id) => events[id]?.name).filter(Boolean)[0] || "",
      planName: grant.via,
      expiresAt: grant.expiresAt,
      liveNow: 0,
    });
  }

  const stats = await presenceStatsByRoom(granted.map((r) => r.id));
  for (const room of granted) room.liveNow = stats[room.id]?.liveNow || 0;

  // Soonest first; manual rooms (no schedule) after scheduled ones.
  granted.sort((a, b) => {
    if (!a.startsAt && !b.startsAt) return a.name.localeCompare(b.name);
    if (!a.startsAt) return 1;
    if (!b.startsAt) return -1;
    return new Date(a.startsAt) - new Date(b.startsAt);
  });
  return granted;
}

export async function getMemberRoom(email, roomId) {
  if (!roomId) return null;
  const rooms = await listMemberRooms(email);
  return rooms.find((r) => r.id === roomId) || null;
}

// Anything this member may play and therefore heartbeat for — a live room or an
// on-demand library item. Both write into the same presence table, so recordings
// and simulive get measured viewers from the Watch player too.
export async function getMemberPlayable(email, id) {
  if (!id) return null;
  const room = await getMemberRoom(email, id);
  if (room) return room;
  const items = await listMemberWatchlist(email);
  return items.find((i) => i.id === id) || null;
}

// The round clock and broadcasts a breakout's parent session carries. Gated on
// the member holding at least one room in that round, and narrowed to the two
// config keys the attendee view needs — the rest of the session stays private.
export async function getRoundState(email, sessionId) {
  if (!sessionId) return null;
  const rooms = await listMemberRooms(email);
  if (!rooms.some((r) => r.parentSessionId === sessionId)) return null;

  const sb = adminClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("conference_records")
      .select("id, config")
      .eq("id", sessionId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("[portal.live.round]", error.message);
      return null;
    }
    const config = asObject(data.config);
    return {
      id: data.id,
      config: {
        timerEndsAt: config.timerEndsAt || "",
        broadcasts: Array.isArray(config.broadcasts) ? config.broadcasts : [],
      },
    };
  } catch (e) {
    console.error("[portal.live.round]", e);
    return null;
  }
}
