import { NextResponse } from "next/server";
import { roomPresenceStats } from "@/lib/live/presence";

export async function GET(request) {
  const roomId = new URL(request.url).searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  return NextResponse.json(await roomPresenceStats(roomId));
}
