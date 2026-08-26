import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { getMemberPlayable } from "@/lib/portal/live";
import { touchPresence } from "@/lib/live/presence";

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
