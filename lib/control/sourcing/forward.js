import { ApiError } from "../../staff_access/errors.js";

// Calls one of the dashboard's /api/sourcing/rfps/[id]/* handlers with the app's Bearer token, so link minting and the
// venue emails live in one place. Those handlers answer { error: "…" } on failure; Control answers ApiError.
export async function forwardRfpAction(handler, request, rfpId, body) {
  const forwarded = new Request(new URL(request.url), {
    method: "POST",
    headers: { authorization: request.headers.get("authorization") || "", "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const response = await handler(forwarded, { params: Promise.resolve({ rfpId }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === "string" && data.error ? data.error : "Something went wrong.";
    throw new ApiError("rfp_action_failed", response.status, message);
  }
  return data;
}
