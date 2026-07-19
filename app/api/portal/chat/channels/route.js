import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberChannels } from "@/lib/portal/chat";

// GET -> { channels } the signed-in member participates in. Optional ?kind=
// filters by channel kind (e.g. "event" for Community, "qa" for Q&A).
export async function GET(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const kind = new URL(request.url).searchParams.get("kind") || null;
  const channels = await listMemberChannels(member.id, { kind });
  return NextResponse.json({ channels });
}
