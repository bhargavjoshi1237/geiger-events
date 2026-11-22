import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { getMemberCategories, saveMemberCategories } from "@/lib/push/server/store";

// The member's push categories ({ tickets, reminders, updates, messages, community, meetings }); a missing key is on.
export async function GET() {
  const member = await getSessionMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({ categories: await getMemberCategories(member.id) });
}

export async function PUT(request) {
  const member = await getSessionMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const categories = await saveMemberCategories(member.id, body?.categories);
    return NextResponse.json({ categories });
  } catch (e) {
    console.error("[portal.push.preferences]", e);
    return NextResponse.json({ error: "Couldn't save your notification settings." }, { status: 503 });
  }
}
