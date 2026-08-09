import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { getMemberPlayable } from "@/lib/portal/live";
import { touchPresence } from "@/lib/live/presence";

// POST -> { ok }. One presence heartbeat for a room or library item, every 30s
// from whichever player is open.
// Fails open on the metric: a rejected write returns ok:false rather than an
// error status, so a stats problem can never interrupt someone's viewing. Access
// still fails closed — a member may only heartbeat a room they are entitled to.
export async function POST(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { roomId, sessionKey, seconds } = body;
  if (!roomId || !sessionKey) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const playable = await getMemberPlayable(member.email, roomId);
  if (!playable) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const ok = await touchPresence({
    roomId,
    memberId: member.id,
    sessionKey,
    seconds,
  });
  return NextResponse.json({ ok });
}
