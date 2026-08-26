import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { getMemberRoom } from "@/lib/portal/live";

export async function GET(request, { params }) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const room = await getMemberRoom(member.email, id);
  if (!room) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ room });
}
