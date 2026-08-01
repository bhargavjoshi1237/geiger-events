import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { randomToken } from "@/lib/portal/session";
import { sendNotificationEmail } from "@/lib/email/notifications";
import { listMemberProjectIds } from "@/lib/portal/memberships";

// { email, origin, basePath } -> always { ok:true } (never reveals existence).
// When the member exists, mint a one-time setup token and email the link.
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
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
  const { error } = await sb
    .from("portal_password_setups")
    .insert({ member_id: member.id, token_hash: tokenHash, expires_at: expires });
  if (error) {
    console.error("[portal.request-setup]", error.message);
    return generic;
  }

  let base = "";
  try {
    if (body.origin && /^https?:\/\//i.test(body.origin)) {
      base = new URL(body.origin).origin;
    }
  } catch {
    base = "";
  }
  const setupUrl = `${base}${body.basePath || ""}/login?setup=${token}`;
  // Reuse the deployed shared "account.password_reset" template (dash is remote,
  // https://geiger.studio) — its CTA links to data.resetUrl. A dedicated
  // events.portal_set_password template would need a dash code change + prod
  // deploy, so route the setup/reset link through this existing one for now.
  // A portal member is global (one row per email across the suite), so only gate
  // this on Settings -> Notifications when they belong to exactly one project.
  // With several, no single project's toggle may lock them out of their account.
  const projectIds = await listMemberProjectIds(clean);
  await sendNotificationEmail({
    projectId: projectIds.length === 1 ? projectIds[0] : null,
    notification: "portal_set_password",
    template: "account.password_reset",
    to: clean,
    subject: "Set your Geiger Events password",
    data: {
      recipientName: member.name || "there",
      resetUrl: setupUrl,
      expiresIn: "1 hour",
    },
  });
  return generic;
}
