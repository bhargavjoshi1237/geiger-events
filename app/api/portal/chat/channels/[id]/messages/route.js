import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { postMemberMessage } from "@/lib/portal/chat";

const ERR_STATUS = {
  bad_request: 400,
  forbidden: 403,
  muted: 403,
  announce_only: 403,
  unavailable: 409,
  failed: 500,
};
const ERR_MSG = {
  bad_request: "Write a message first.",
  forbidden: "You're not in this chat.",
  muted: "You've been muted in this chat.",
  announce_only: "Only the organiser can post here.",
  unavailable: "This chat isn't available.",
  failed: "Couldn't send your message.",
};

// POST { body, replyTo? } -> post a message to the channel as this member.
export async function POST(request, { params }) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const { body, replyTo } = await request.json().catch(() => ({}));
  const result = await postMemberMessage(member.id, member.name, id, {
    body,
    replyTo: replyTo || null,
  });
  if (result.error) {
    return NextResponse.json(
      { error: ERR_MSG[result.error] || "Couldn't send." },
      { status: ERR_STATUS[result.error] || 400 },
    );
  }
  return NextResponse.json({ message: result.message });
}
