import { createClient } from "@supabase/supabase-js";

import { adminClient } from "@/lib/supabase/admin";
import { sendNotificationEmail } from "@/lib/email/notifications";

// Server-only helpers for shared floor plans (/plan/<token> and /api/plan-share/<token>). The token is the only credential;
// every check (revoked, expired, permission, limits) happens inside the floor_plan_public_* database functions.

export const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function anonClient() {
  if (!SUPABASE_URL() || !ANON_KEY()) return null;
  return createClient(SUPABASE_URL(), ANON_KEY(), {
    db: { schema: "events" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function callPublic(fn, args, label) {
  const sb = anonClient();
  if (!sb) return { ok: false, reason: "unavailable" };
  try {
    const { data, error } = await sb.rpc(fn, args);
    if (error) {
      console.error(`[plan_share.${label}]`, error.message);
      return { ok: false, reason: "unavailable" };
    }
    return data && typeof data === "object" ? data : { ok: false, reason: "not_found" };
  } catch (e) {
    console.error(`[plan_share.${label}]`, e);
    return { ok: false, reason: "unavailable" };
  }
}

// What the share page renders: { ok, share, plan, comments } or { ok: false, reason }. Never throws.
export async function fetchSharedPlan(token) {
  if (!TOKEN_RE.test(String(token || ""))) return { ok: false, reason: "not_found" };
  return callPublic("floor_plan_public_get", { p_token: token }, "get");
}

export async function recordShareView(token) {
  if (!TOKEN_RE.test(String(token || ""))) return { ok: false, reason: "not_found" };
  return callPublic("floor_plan_public_view", { p_token: token }, "view");
}

const coord = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function postGuestComment(token, input) {
  if (!TOKEN_RE.test(String(token || ""))) return { ok: false, reason: "not_found" };
  const parentId = UUID_RE.test(String(input?.parentId || "")) ? input.parentId : null;
  return callPublic(
    "floor_plan_public_comment",
    {
      p_token: token,
      p_name: String(input?.name || "").slice(0, 200),
      p_body: String(input?.body || "").slice(0, 4000),
      p_x: coord(input?.xM),
      p_y: coord(input?.yM),
      p_item_id: input?.itemId ? String(input.itemId).slice(0, 64) : null,
      p_parent_id: parentId,
    },
    "comment",
  );
}

// The public origin + basePath links in emails point at.
export function publicBaseUrl(request) {
  try {
    const configured = process.env.GEIGER_OPERATIONS_PUBLIC_URL;
    const base = configured
      ? new URL(configured)
      : new URL(process.env.NEXT_PUBLIC_BASE_PATH || "/", new URL(request.url).origin);
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) return "";
    return base.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderCommentEmail({ planName, authorName, linkLabel, body, isReply, dashboardUrl }) {
  const p = (html) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151">${html}</p>`;
  const button = (url, label) =>
    url
      ? `<a href="${esc(url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111827;color:#ffffff">${esc(label)}</a>`
      : "";
  const via = linkLabel ? ` through the “${esc(linkLabel)}” link` : " through a share link";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 18px;font-size:13px;font-weight:600;color:#6b7280">Geiger Events · Floor plans</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827">${esc(isReply ? "New reply on" : "New comment on")} ${esc(planName)}</h1>
${p(`<strong>${esc(authorName)}</strong> ${isReply ? "replied" : "commented"}${via}:`)}
<div style="margin:0 0 18px;padding:12px 14px;border-left:3px solid #d1d5db;background:#f9fafb;font-size:14px;line-height:1.5;color:#374151;white-space:pre-wrap">${esc(body)}</div>
<div style="margin:4px 0 12px">${button(dashboardUrl, "Open the plan")}</div>
</td></tr>
<tr><td style="padding:14px 28px 24px;border-top:1px solid #f0f0f0;font-size:12px;line-height:1.5;color:#9ca3af">You get this because you created this floor plan. Further comments from the same link within 15 minutes don't send another email.</td></tr>
</table></td></tr></table></body></html>`;
}

// Emails the plan's creator about a guest comment. Best-effort: logs and returns on any failure.
export async function notifyGuestComment({ request, comment }) {
  try {
    const admin = adminClient();
    if (!admin || !comment?.id) return;
    const { data: row } = await admin
      .from("floor_plan_comments")
      .select("id, project_id, floor_plan_id, parent_id, share_id, body, author_name")
      .eq("id", comment.id)
      .maybeSingle();
    if (!row) return;
    const [{ data: plan }, { data: share }] = await Promise.all([
      admin.from("floor_plans").select("id, name, created_by").eq("id", row.floor_plan_id).maybeSingle(),
      row.share_id
        ? admin.from("floor_plan_shares").select("label, created_by").eq("id", row.share_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const recipientId = plan?.created_by || share?.created_by;
    if (!plan || !recipientId) return;
    const { data: user, error } = await admin.auth.admin.getUserById(recipientId);
    const to = user?.user?.email;
    if (error || !to) return;

    const base = publicBaseUrl(request);
    const dashboardUrl = base ? `${base}/project/${row.project_id}/collaborationsharing?record=${plan.id}` : "";
    const isReply = Boolean(row.parent_id);
    const res = await sendNotificationEmail({
      projectId: row.project_id,
      notification: "floor_plan_comment",
      template: "events.floor_plan_comment",
      to,
      subject: `${row.author_name || "A guest"} ${isReply ? "replied" : "commented"} on ${plan.name || "your floor plan"}`,
      html: renderCommentEmail({
        planName: plan.name || "your floor plan",
        authorName: row.author_name || "A guest",
        linkLabel: share?.label || "",
        body: row.body,
        isReply,
        dashboardUrl,
      }),
      data: { planId: plan.id, commentId: row.id },
    });
    if (!res?.ok && !res?.skipped) console.error("[plan_share.notify]", res?.error);
  } catch (e) {
    console.error("[plan_share.notify]", e);
  }
}

export function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
