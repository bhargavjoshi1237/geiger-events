import { adminClient } from "@/lib/supabase/admin";


export const LIVE_WINDOW_SECONDS = 90;

const EMPTY = { liveNow: 0, uniqueViewers: 0, secondsWatched: 0 };

export async function touchPresence({ roomId, memberId, sessionKey, seconds = 0 }) {
  if (!roomId || !sessionKey) return false;
  const sb = adminClient();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc("room_presence_touch", {
      p_room_id: roomId,
      p_member_id: memberId || null,
      p_session_key: sessionKey,
      p_seconds: Math.max(0, Math.round(Number(seconds) || 0)),
    });
    if (error) {
      console.error("[live.presence.touch]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[live.presence.touch]", e);
    return false;
  }
}

export async function presenceStatsByRoom(roomIds) {
  const ids = [...new Set((roomIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const sb = adminClient();
  if (!sb) return {};
  try {
    const { data, error } = await sb
      .from("room_presence")
      .select("room_id, member_id, session_key, last_seen_at, seconds_watched")
      .in("room_id", ids)
      .is("deleted_at", null);
    if (error) {
      console.error("[live.presence.stats]", error.message);
      return {};
    }
    const cutoff = Date.now() - LIVE_WINDOW_SECONDS * 1000;
    const out = {};
    const seen = {};
    for (const row of data || []) {
      const bucket = (out[row.room_id] ||= { ...EMPTY });
      const viewers = (seen[row.room_id] ||= new Set());
      if (new Date(row.last_seen_at).getTime() >= cutoff) bucket.liveNow += 1;
      viewers.add(row.member_id || `s:${row.session_key}`);
      bucket.secondsWatched += Number(row.seconds_watched) || 0;
    }
    for (const id of Object.keys(out)) out[id].uniqueViewers = seen[id].size;
    return out;
  } catch (e) {
    console.error("[live.presence.stats]", e);
    return {};
  }
}

export async function roomPresenceStats(roomId) {
  if (!roomId) return { ...EMPTY };
  const byRoom = await presenceStatsByRoom([roomId]);
  return byRoom[roomId] || { ...EMPTY };
}
