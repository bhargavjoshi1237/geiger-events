import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { toggleMemberReaction } from "@/lib/portal/chat";

// POST { messageId, emoji } -> toggle this member's reaction on a message.
export async function POST(request, { params }) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const { messageId, emoji } = await request.json().catch(() => ({}));
  const result = await toggleMemberReaction(member.id, id, messageId, emoji);
  if (result.error) {
    return NextResponse.json({ error: "Couldn't react." }, { status: 400 });
  }
  return NextResponse.json({ message: result.message });
}
