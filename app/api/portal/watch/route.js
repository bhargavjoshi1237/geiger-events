import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberWatchlist } from "@/lib/portal/watch";

export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const items = await listMemberWatchlist(member.email);
  return NextResponse.json({ items });
}
