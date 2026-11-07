import { bidPayloadFromDraft } from "@/lib/sourcing/rfp_model";
import { TOKEN_RE, anonClient, fetchPublicRfp, json } from "@/lib/sourcing/server";

const MAX_BODY = 200_000;

// The venue's side of an RFP: { action: "submit", bid } files a revision, { action: "decline", reason } passes.
// The token is the only credential; validation and deadlines are enforced in the rfp_public_* functions.
export async function POST(request, { params }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token || "")) return json({ ok: false, reason: "not_found" }, 404);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) {
    return json({ ok: false, reason: "invalid", message: "That proposal is too large to send." }, 413);
  }

  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY) {
    return json({ ok: false, reason: "invalid", message: "That proposal is too large to send." }, 413);
  }
  let body = null;
  try {
    body = JSON.parse(raw || "null");
  } catch {
    body = null;
  }

  const sb = anonClient();
  if (!sb) return json({ ok: false, reason: "unavailable" }, 503);

  let rpc;
  if (body?.action === "submit") {
    rpc = await sb.rpc("rfp_public_submit", {
      p_token: token,
      p_payload: bidPayloadFromDraft(body.bid && typeof body.bid === "object" ? body.bid : {}),
    });
  } else if (body?.action === "decline") {
    rpc = await sb.rpc("rfp_public_decline", {
      p_token: token,
      p_reason: String(body.reason || "").slice(0, 1000),
    });
  } else {
    return json({ ok: false, reason: "invalid", message: "Unknown action." }, 400);
  }

  if (rpc.error) {
    console.error("[rfp.public.post]", rpc.error.message);
    return json({ ok: false, reason: "unavailable" }, 500);
  }
  const result = rpc.data && typeof rpc.data === "object" ? rpc.data : { ok: false, reason: "unavailable" };
  const state = await fetchPublicRfp(token);
  const status = result.ok
    ? 200
    : result.reason === "not_found"
      ? 404
      : result.reason === "invalid"
        ? 422
        : result.reason === "unavailable"
          ? 500
          : 409;
  return json({ ...result, data: state }, status);
}
