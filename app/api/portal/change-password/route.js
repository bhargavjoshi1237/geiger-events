import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember, hashPassword, verifyPassword } from "@/lib/portal/session";

// POST { currentPassword, newPassword } -> verifies the current password and sets
// a new one (min 8). The current session stays valid.
export async function POST(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { currentPassword, newPassword } = await request.json().catch(() => ({}));
  if (!newPassword || String(newPassword).length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 },
    );
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const { data: row } = await sb
    .from("portal_members")
    .select("password_hash")
    .eq("id", member.id)
    .maybeSingle();

  // If a password is set, the current one must match. (A passwordless member who
  // reached the portal shouldn't happen, but treat it as needing the setup link.)
  if (!row?.password_hash) {
    return NextResponse.json(
      { error: "Set a password from the sign-in screen first." },
      { status: 400 },
    );
  }
  if (!verifyPassword(String(currentPassword || ""), row.password_hash)) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 401 },
    );
  }

  const { error } = await sb
    .from("portal_members")
    .update({
      password_hash: hashPassword(newPassword),
      password_set_at: new Date().toISOString(),
    })
    .eq("id", member.id);
  if (error) {
    console.error("[portal.change-password]", error.message);
    return NextResponse.json({ error: "Couldn't update." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
