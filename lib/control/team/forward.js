import { ApiError } from "../../staff_access/errors.js";

// Calls one of the dashboard's own /api/settings/* handlers with the app's Bearer token, so key minting and webhook
// rules live in one place. Those handlers answer { error: { code, message } }; Control answers ApiError.
export async function forwardToHandler(handler, request, { method, body, search = "" }) {
  const url = new URL(request.url);
  url.search = search;
  const forwarded = new Request(url, {
    method,
    headers: { authorization: request.headers.get("authorization") || "", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(forwarded);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "Something went wrong.";
    throw new ApiError(data?.error?.code || "error", response.status, message);
  }
  return data;
}
