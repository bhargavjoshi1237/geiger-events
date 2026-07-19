import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { getMemberChannel } from "@/lib/portal/chat";

// GET /api/portal/chat/channels/<id> -> channel + message history (marks read).
export async function GET(_request, { params }) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const channel = await getMemberChannel(member.id, id);
  if (!channel) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ channel });
}
