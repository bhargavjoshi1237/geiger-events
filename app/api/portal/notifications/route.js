import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberNotifications } from "@/lib/portal/notifications";

// GET -> { items, unread }. The member's event announcements feed.
export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const seenAt = member.metadata?.notificationsSeenAt || null;
  const feed = await listMemberNotifications(member.email, seenAt);
  return NextResponse.json(feed);
}

// POST -> marks the feed read (stamps notificationsSeenAt = now on the member).
export async function POST() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const sb = adminClient();
  if (sb) {
    await sb
      .from("portal_members")
      .update({
        metadata: {
          ...(member.metadata || {}),
          notificationsSeenAt: new Date().toISOString(),
        },
      })
      .eq("id", member.id);
  }
  return NextResponse.json({ ok: true });
}
