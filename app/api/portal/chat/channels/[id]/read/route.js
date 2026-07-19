import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { markMemberRead } from "@/lib/portal/chat";

// POST -> advance this member's read cursor for the channel.
export async function POST(_request, { params }) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const ok = await markMemberRead(member.id, id);
  return NextResponse.json({ ok });
}
