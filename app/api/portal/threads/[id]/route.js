import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { getMemberThread } from "@/lib/portal/support";

// GET /api/portal/threads/<id> -> the thread + its messages (marks it read).
export async function GET(_request, { params }) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const thread = await getMemberThread(member.id, id);
  if (!thread) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ thread });
}
