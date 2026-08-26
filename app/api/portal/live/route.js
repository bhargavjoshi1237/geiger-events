import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberRooms } from "@/lib/portal/live";

export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const rooms = await listMemberRooms(member.email);
  return NextResponse.json({ rooms });
}
