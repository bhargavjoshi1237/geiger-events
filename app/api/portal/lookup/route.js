import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

// { email } -> { exists, hasPassword }. Drives the email-first login UI.
export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ exists: false, hasPassword: false });
  const { data } = await sb
    .from("portal_members")
    .select("id, password_hash")
    .eq("email", clean)
    .maybeSingle();
  return NextResponse.json({
    exists: Boolean(data),
    hasPassword: Boolean(data?.password_hash),
  });
}
