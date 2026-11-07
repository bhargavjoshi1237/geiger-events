import { after } from "next/server";

import {
  TOKEN_RE,
  fetchSharedPlan,
  json,
  notifyGuestComment,
  postGuestComment,
  recordShareView,
} from "@/lib/plan_sharing/server";

const MAX_BODY = 20_000;

const statusFor = (reason) =>
  reason === "not_found" || reason === "revoked" || reason === "expired"
    ? 404
    : reason === "forbidden"
      ? 403
      : reason === "invalid"
        ? 422
        : reason === "rate_limited"
          ? 429
          : 500;

// A shared floor plan, refreshed by the share page (new comments, newer saves).
export async function GET(_request, { params }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token || "")) return json({ ok: false, reason: "not_found" }, 404);
  const data = await fetchSharedPlan(token);
  return json(data, data.ok ? 200 : statusFor(data.reason));
}

// { action: "view" } counts an open; { action: "comment", name, body, xM, yM, itemId, parentId } posts a guest comment or reply.
export async function POST(request, { params }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token || "")) return json({ ok: false, reason: "not_found" }, 404);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) {
    return json({ ok: false, reason: "invalid", message: "That comment is too long." }, 413);
  }
  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY) return json({ ok: false, reason: "invalid", message: "That comment is too long." }, 413);
  let body = null;
  try {
    body = JSON.parse(raw || "null");
  } catch {
    body = null;
  }

  if (body?.action === "view") {
    const result = await recordShareView(token);
    return json(result, result.ok ? 200 : statusFor(result.reason));
  }

  if (body?.action === "comment") {
    const result = await postGuestComment(token, body);
    if (!result.ok) return json(result, statusFor(result.reason));
    if (result.notify && result.comment?.id) {
      after(() => notifyGuestComment({ request, comment: result.comment }));
    }
    const data = await fetchSharedPlan(token);
    return json({ ok: true, comment: result.comment, data }, 200);
  }

  return json({ ok: false, reason: "invalid", message: "Unknown action." }, 400);
}
