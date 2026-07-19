import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { voteMemberPoll } from "@/lib/portal/chat";

// POST { messageId, optionId } -> toggle this member's vote on a poll message.
export async function POST(request, { params }) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const { messageId, optionId } = await request.json().catch(() => ({}));
  const result = await voteMemberPoll(member.id, id, messageId, optionId);
  if (result.error) {
    return NextResponse.json({ error: "Couldn't record your vote." }, { status: 400 });
  }
  return NextResponse.json({ message: result.message });
}
