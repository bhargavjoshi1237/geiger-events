import { NextResponse } from "next/server";
import { presenceStatsByRoom } from "@/lib/live/presence";

// GET ?roomIds=a,b,c -> { [roomId]: { liveNow, uniqueViewers, secondsWatched } }
// Organiser-side rollups for a whole module list in one read.
export async function GET(request) {
  const raw = new URL(request.url).searchParams.get("roomIds") || "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({});
  return NextResponse.json(await presenceStatsByRoom(ids));
}
