import { NextResponse } from "next/server";
import { roomPresenceStats } from "@/lib/live/presence";

// GET ?roomId= -> presence rollup for the organiser's room detail.
export async function GET(request) {
  const roomId = new URL(request.url).searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  return NextResponse.json(await roomPresenceStats(roomId));
}
