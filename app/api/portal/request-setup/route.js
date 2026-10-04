import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { randomToken } from "@/lib/portal/session";
import { sendNotificationEmail } from "@/lib/email/notifications";
import { listMemberProjectIds } from "@/lib/portal/memberships";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const clean = String(body.email || "").trim().toLowerCase();
  const generic = NextResponse.json({ ok: true });
  if (!clean || !clean.includes("@")) return generic;

  const sb = adminClient();
  if (!sb) return generic;
  const { data: member } = await sb
    .from("portal_members")
    .select("id, name")
    .eq("email", clean)
    .maybeSingle();
  if (!member) return generic;

  const { token, tokenHash } = randomToken();
  const expires = new Date(Date.now() + 3600000).toISOString();
  const { error } = await sb
    .from("portal_password_setups")
    .insert({ member_id: member.id, token_hash: tokenHash, expires_at: expires });
  if (error) {
    console.error("[portal.request-setup]", error.message);
    return generic;
  }

  let base;
  try {
    const configured = process.env.GEIGER_OPERATIONS_PUBLIC_URL;
    if (configured) {
      base = new URL(configured);
    } else {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      if (basePath && !/^\/(?!\/)[^?#]*$/.test(basePath)) throw new Error("Invalid application base path");
      base = new URL(basePath || "/", new URL(request.url).origin);
    }
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error("Invalid application public URL");
  } catch {
    console.error("[portal.request-setup] Invalid application URL configuration");
    return generic;
  }
  const setupUrl = new URL(`${base.href.replace(/\/$/, "")}/login`);
  setupUrl.searchParams.set("setup", token);
  const projectIds = await listMemberProjectIds(clean);
  await sendNotificationEmail({
    projectId: projectIds.length === 1 ? projectIds[0] : null,
    notification: "portal_set_password",
    template: "account.password_reset",
    to: clean,
    subject: "Set your Geiger Events password",
    data: {
      recipientName: member.name || "there",
      resetUrl: setupUrl.href,
      expiresIn: "1 hour",
    },
  });
  return generic;
}
