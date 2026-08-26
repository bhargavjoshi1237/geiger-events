import { NextResponse } from "next/server";
import { presenceStatsByRoom } from "@/lib/live/presence";

export async function GET(request) {
  const raw = new URL(request.url).searchParams.get("roomIds") || "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({});
  return NextResponse.json(await presenceStatsByRoom(ids));
}
