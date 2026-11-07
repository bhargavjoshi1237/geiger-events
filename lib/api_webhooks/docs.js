import { API_BASE_URL, PAGE_LIMIT, RATE_LIMIT, RETRY_SCHEDULE_SECONDS, formatDuration } from "./catalog.js";

// Reference content for the in-app Docs tab (docs/api.md carries the same reference for people outside the app).

export const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/events",
    scope: "read:events",
    params: "status, updated_since, limit, starting_after",
    description: "Events in the project, newest first. Deleted events are left out.",
  },
  { method: "GET", path: "/events/{id}", scope: "read:events", params: "", description: "One event." },
  {
    method: "GET",
    path: "/orders",
    scope: "read:orders",
    params: "event_id, status, updated_since, limit, starting_after",
    description: "Ticket orders. status is paid, confirmed (free), partially_refunded, refunded or cancelled.",
  },
  { method: "GET", path: "/orders/{id}", scope: "read:orders", params: "", description: "One order." },
  {
    method: "GET",
    path: "/attendees",
    scope: "read:attendees",
    params: "event_id, status, updated_since, limit, starting_after",
    description: "Registrations, with checked_in_at once they've been admitted at the door.",
  },
  {
    method: "GET",
    path: "/checkins",
    scope: "read:checkins",
    params: "event_id, since, limit, starting_after",
    description: "Door and session check-ins. since filters on checked_in_at.",
  },
  {
    method: "POST",
    path: "/checkins",
    scope: "write:checkins",
    params: "JSON: event_id, ticket_code, gate?, session_id?",
    description: "Admit a ticket by its 8-character code, full order or registration id, or scanned QR text.",
  },
];

export const API_ERRORS = [
  { status: 400, codes: "invalid_parameter, missing_parameter, invalid_cursor, invalid_json", meaning: "Fix the request and try again." },
  { status: 401, codes: "missing_api_key, invalid_key, revoked_key, expired_key", meaning: "The key is missing or no longer works." },
  { status: 403, codes: "insufficient_scope", meaning: "The key doesn't have the permission this endpoint needs." },
  { status: 404, codes: "not_found, ticket_not_found", meaning: "Nothing with that id (or ticket code) in this project." },
  {
    status: 409,
    codes: "ticket_cancelled, ticket_refunded, ticket_waitlisted, capacity_full, checkin_not_configured",
    meaning: "The check-in was refused. The message says why.",
  },
  { status: 429, codes: "rate_limited", meaning: "Slow down; wait for Retry-After seconds." },
  { status: 503, codes: "unavailable", meaning: "Temporary problem on our side. Retry with backoff." },
];

export const DOC_SNIPPETS = {
  curl: `curl ${API_BASE_URL}/orders?limit=10 \\
  -H "Authorization: Bearer gev_live_…"`,
  list: `{
  "object": "list",
  "data": [ { "object": "order", "id": "3f2b9c1e-…", … } ],
  "has_more": true,
  "next_cursor": "3f2b9c1e-…"
}

# Next page:
GET ${API_BASE_URL}/orders?limit=10&starting_after=3f2b9c1e-…`,
  error: `{
  "error": {
    "status": 403,
    "code": "insufficient_scope",
    "message": "This key doesn't have the read:orders scope."
  }
}`,
  checkin: `curl -X POST ${API_BASE_URL}/checkins \\
  -H "Authorization: Bearer gev_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "event_id": "9b1f2c3d-…", "ticket_code": "3F2B9C1E", "gate": "North" }'

# 201 { "object": "checkin_result", "admitted": true, "already_checked_in": false, "attendee": { … }, "checkin": { … } }
# 200 { "object": "checkin_result", "admitted": false, "already_checked_in": true, … }`,
  envelope: `POST https://your-server.example.com/geiger-webhooks
Content-Type: application/json
Geiger-Event-Id: 6a1f…
Geiger-Event-Type: order.paid
Geiger-Delivery-Id: 0c7e…
Geiger-Signature: t=1794139200,v1=5f2b…

{
  "id": "6a1f…",
  "type": "order.paid",
  "created": 1794139200,
  "project_id": "e7e7…",
  "data": { "object": "order", … }
}`,
  verify: `import crypto from "node:crypto";
import express from "express";

const app = express();

// Verify against the raw body: re-serialised JSON won't match the signature.
app.post("/geiger-webhooks", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("Geiger-Signature") || "";
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=")));
  const expected = crypto
    .createHmac("sha256", process.env.GEIGER_WEBHOOK_SECRET)
    .update(\`\${parts.t}.\${req.body}\`)
    .digest("hex");

  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  const valid =
    typeof parts.v1 === "string" &&
    parts.v1.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
  if (!valid || !fresh) return res.status(400).send("Invalid signature");

  const event = JSON.parse(req.body);
  // Retries and replays can deliver an event twice: skip ids you've already handled.
  console.log(event.type, event.data.id);
  res.sendStatus(200);
});

app.listen(3000);`,
};

export const DOC_FACTS = {
  baseUrl: API_BASE_URL,
  pageDefault: PAGE_LIMIT.default,
  pageMax: PAGE_LIMIT.max,
  rateLimit: RATE_LIMIT.limit,
  retrySchedule: RETRY_SCHEDULE_SECONDS.map(formatDuration).join(", "),
};
