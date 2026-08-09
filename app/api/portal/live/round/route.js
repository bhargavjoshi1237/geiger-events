import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { getRoundState } from "@/lib/portal/live";

// GET ?sessionId= -> { session }. The round clock and broadcasts a breakout's
// parent session carries, for the attendee-facing countdown. Only the config a
// member may see is returned, and only if they hold a room in that round.
export async function GET(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const session = await getRoundState(member.email, sessionId);
  if (!session) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ session });
}
