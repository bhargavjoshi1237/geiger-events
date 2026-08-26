import { NextResponse } from "next/server";
import { listEntitledMembers } from "@/lib/live/roster";

export async function GET(request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  return NextResponse.json({ members: await listEntitledMembers(sessionId) });
}
