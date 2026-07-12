import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember } from "@/lib/portal/session";

// POST { name, phone } -> updates the signed-in member's display name and phone
// (phone lives in the metadata bag). Returns the updated view fields.
export async function POST(request) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? member.name ?? "").trim().slice(0, 120);
  const phone = String(body.phone ?? member.metadata?.phone ?? "").trim().slice(0, 40);

  const metadata = { ...(member.metadata || {}), phone };
  const { error } = await sb
    .from("portal_members")
    .update({ name, metadata })
    .eq("id", member.id);
  if (error) {
    console.error("[portal.profile]", error.message);
    return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, name, phone });
}
