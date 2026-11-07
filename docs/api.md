# Geiger Events API & Webhooks

Read a project's events, orders, attendees and check-ins, check guests in from your own systems, and get changes pushed to your server as they happen. Everything here is managed in **Settings → API & Webhooks**, which also carries this reference on its **Docs** tab.

## Authentication

Create a key on the **API keys** tab. The full key (`gev_live_…`) is shown once, when it's created; Geiger stores only a hash of it. Send it as a bearer token:

```
Authorization: Bearer gev_live_…
```

A key only ever sees the project it was created in, and only what its permissions allow. Keys belong on your server: never ship one in a browser or mobile app. Revoke a key and it stops working immediately; a key can also be created with an expiry (30 days, 90 days or 1 year).

| Permission | Allows |
|---|---|
| `read:events` | List events and fetch one by id. |
| `read:orders` | List ticket orders, with buyer, amounts and status. |
| `read:attendees` | List registrations and whether they've checked in. |
| `read:checkins` | List door and session check-ins. |
| `write:checkins` | Admit a ticket by its code, as a door scanner would. |

**Base URL:** `https://geiger.studio/events/api/v1` (in local development, `http://localhost:3000/api/v1`).

```bash
curl https://geiger.studio/events/api/v1/orders?limit=10 \
  -H "Authorization: Bearer gev_live_…"
```

## Endpoints

All responses are JSON. Times are ISO 8601 in UTC; amounts are decimals in the event's currency (the `currency` field, lower-case ISO 4217). Enumerations (`status`, `type`, …) are lower-case snake_case.

| Endpoint | Permission | Parameters | Returns |
|---|---|---|---|
| `GET /events` | `read:events` | `status`, `updated_since`, `limit`, `starting_after` | Events in the project, newest first. Deleted events are left out. `status` is `draft`, `on_sale`, `sold_out`, `scheduled` or `ended`. |
| `GET /events/{id}` | `read:events` | — | One event. |
| `GET /orders` | `read:orders` | `event_id`, `status`, `updated_since`, `limit`, `starting_after` | Ticket orders. `status` is `paid`, `confirmed` (free), `partially_refunded`, `refunded` or `cancelled`. |
| `GET /orders/{id}` | `read:orders` | — | One order. |
| `GET /attendees` | `read:attendees` | `event_id`, `status`, `updated_since`, `limit`, `starting_after` | Registrations (paid buyers have one too), with `checked_in_at` once admitted at the door. `status` is `confirmed`, `pending`, `waitlisted`, `declined`, `cancelled` or `checked_in`. |
| `GET /checkins` | `read:checkins` | `event_id`, `since`, `limit`, `starting_after` | Door and session check-ins. `since` filters on `checked_in_at`. |
| `POST /checkins` | `write:checkins` | JSON body: `event_id`, `ticket_code`, `gate?`, `session_id?` | Admits a ticket. `ticket_code` may be the 8-character code, the full order or registration id, or the scanned QR text. |

`updated_since` and `since` accept an ISO 8601 timestamp or unix seconds.

### Objects

```json
{
  "object": "order",
  "id": "3f2b9c1e-8d4a-4b6f-9e2a-1c5d7f8a9b0c",
  "event_id": "9b1f2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d",
  "ticket_code": "3F2B9C1E",
  "status": "paid",
  "buyer": { "name": "Ada Lovelace", "email": "ada@example.com" },
  "ticket_name": "General Admission",
  "quantity": 2,
  "unit_price": 49,
  "total": 98,
  "refunded_total": 0,
  "currency": "gbp",
  "payment_intent": "pi_3Q0abc123",
  "cancelled_at": null,
  "created_at": "2026-11-08T09:12:44+00:00",
  "updated_at": "2026-11-08T09:12:44+00:00"
}
```

Events, attendees and check-ins follow the same pattern (`object`, `id`, fields, `created_at`, `updated_at`); see the event type samples below for each shape.

### Checking a guest in

API check-ins run through the same admission rules as the door app: cancelled, refunded and waitlisted tickets are refused, a ticket can't be admitted twice at the same door or session, and capacity caps apply. They're recorded through the project's first active **staff** role under Check-in → Staff roles, so the project needs one (with an access code); otherwise the call answers `409 checkin_not_configured`.

```bash
curl -X POST https://geiger.studio/events/api/v1/checkins \
  -H "Authorization: Bearer gev_live_…" \
  -H "Content-Type: application/json" \
  -d '{ "event_id": "9b1f2c3d-…", "ticket_code": "3F2B9C1E", "gate": "North" }'
```

- `201` `{ "object": "checkin_result", "admitted": true, "already_checked_in": false, "attendee": { … }, "checkin": { … } }`
- `200` `{ "object": "checkin_result", "admitted": false, "already_checked_in": true, "reason": "inside", … }`
- `409` with `ticket_cancelled`, `ticket_refunded`, `ticket_waitlisted`, `ticket_pending`, `ticket_declined` or `capacity_full`

## Pagination

Lists are newest first and use cursors, so pages stay stable while data changes. Pass `limit` (default 25, up to 100). When `has_more` is true, ask for the next page with `starting_after` set to `next_cursor`.

```json
{
  "object": "list",
  "data": [ { "object": "order", "id": "3f2b9c1e-…" } ],
  "has_more": true,
  "next_cursor": "3f2b9c1e-…"
}
```

```
GET /events/api/v1/orders?limit=10&starting_after=3f2b9c1e-…
```

To sync changes, keep the time of your last run and pass it as `updated_since` (or `since` for check-ins).

## Errors

Errors use HTTP status codes and one body shape:

```json
{
  "error": {
    "status": 403,
    "code": "insufficient_scope",
    "message": "This key doesn't have the read:orders scope."
  }
}
```

| Status | Codes | Meaning |
|---|---|---|
| 400 | `invalid_parameter`, `missing_parameter`, `invalid_cursor`, `invalid_json` | Fix the request and try again. |
| 401 | `missing_api_key`, `invalid_key`, `revoked_key`, `expired_key` | The key is missing or no longer works. |
| 403 | `insufficient_scope` | The key doesn't have the permission this endpoint needs. |
| 404 | `not_found`, `ticket_not_found` | Nothing with that id (or ticket code) in this project. |
| 409 | `ticket_*`, `capacity_full`, `checkin_not_configured` | The check-in was refused; the message says why. |
| 429 | `rate_limited` | Slow down; wait for `Retry-After` seconds. |
| 503 | `unavailable` | Temporary problem on our side. Retry with backoff. |

## Rate limits

Each key can make **120 requests a minute** (a fixed one-minute window). Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (unix seconds). Past the limit you get `429 rate_limited` with a `Retry-After` header.

## Webhooks

Add an endpoint on the **Webhooks** tab: an `https://` URL on the public internet, the event types to send (or **All events**, which includes types added later) and an optional description. Each endpoint has its own signing secret, which you can reveal or rotate there. Rotation takes effect on the next delivery.

Each event is POSTed as JSON to every enabled endpoint subscribed to its type:

```
POST https://your-server.example.com/geiger-webhooks
Content-Type: application/json
User-Agent: GeigerEvents-Webhooks/1.0
Geiger-Event-Id: 6a1f…
Geiger-Event-Type: order.paid
Geiger-Delivery-Id: 0c7e…
Geiger-Delivery-Attempt: 1
Geiger-Signature: t=1794139200,v1=5f2b…

{
  "id": "6a1f…",
  "type": "order.paid",
  "created": 1794139200,
  "project_id": "e7e7…",
  "data": { "object": "order", … }
}
```

`data` holds the same object the REST API returns.

**Responding.** Answer with any 2xx within 10 seconds and do slow work after responding. Redirects aren't followed.

**Retries.** Anything else (an error status, a timeout, a connection failure) is retried 6 more times, after 1m, 5m, 30m, 2h, 6h and 12h, then marked **Failed**. Test events aren't retried.

**Auto-disable.** An endpoint that fails 50 deliveries in a row with no success for a day is turned off, with the reason shown on the Webhooks tab. Turn it back on there once it's fixed.

**Duplicates and order.** Deliveries can arrive more than once (retries, replays) and out of order. Use `Geiger-Event-Id` (the same as the body's `id`) to skip events you've already handled, and `data.updated_at` to keep the newest state.

**Delivery log.** The **Deliveries** tab lists every send with its status, response code, latency, attempts and next retry. Open one to see the exact payload, the response body (first 2 KB) and each attempt; **Retry now** sends a failed delivery again immediately, and **Replay** sends any delivery again as a new delivery. **Send test event** on an endpoint sends a `webhook.test` event straight away. Events are kept for 30 days.

### Verifying signatures

`Geiger-Signature` is `t=<unix seconds>,v1=<hex>`, where `v1` is the HMAC-SHA256 of `` `${t}.${rawBody}` `` keyed with the endpoint's signing secret. Compute it over the raw request body (re-serialised JSON won't match), compare in constant time, and reject timestamps more than five minutes old.

```js
import crypto from "node:crypto";
import express from "express";

const app = express();

// Verify against the raw body: re-serialised JSON won't match the signature.
app.post("/geiger-webhooks", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("Geiger-Signature") || "";
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=")));
  const expected = crypto
    .createHmac("sha256", process.env.GEIGER_WEBHOOK_SECRET)
    .update(`${parts.t}.${req.body}`)
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

app.listen(3000);
```

### Event types

| Type | When |
|---|---|
| `order.created` | A ticket order was placed, paid or free. |
| `order.paid` | A paid order's payment was confirmed. |
| `order.refunded` | A refund was issued against an order, in full or in part. `data` is the order plus a `refund` object. |
| `order.cancelled` | An order was cancelled; its tickets no longer admit. |
| `registration.created` | Someone registered for an event, including paid buyers. `data` is an attendee. |
| `registration.cancelled` | A registration was cancelled. |
| `checkin.created` | A ticket or registration was admitted at a door or session. `data` is a check-in. |
| `event.published` | An event left draft and went on sale or was scheduled. |
| `event.updated` | An event's name, status, date, time, venue, capacity, visibility, summary or cover changed (ticket-sales counters and page design don't count). |
| `webhook.test` | Sent only by **Send test event**. |

Sample `data` for each type is on the Docs tab in the app.

## Operations

- **Capture.** Events are captured by database triggers on orders, refunds, registrations, check-ins and events, so every write path (checkout, the dashboard, staff apps, imports) emits them. Capture never blocks the original write, and nothing is recorded for a project with no enabled endpoint subscribed to that type.
- **Dispatch.** `/events/api/webhooks/dispatch` sends due deliveries. Vercel Cron calls it once a day (`vercel.json`, Hobby plan limit) with `Authorization: Bearer $CRON_SECRET`; it needs the `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. For near-real-time delivery, call it every minute from Vercel Pro cron, Supabase pg_cron or an external pinger with the same header; retry delays are the earliest a retry can go. Manual sends from the dashboard (test, retry, replay) don't wait for it.
