# NFC Hardware API — reader integration

Base URL: `https://<your-app>/api/nfc/tap`. One endpoint, JSON, HTTPS only.
Auth is the **device key** — per entry point, provisioned from the dashboard
(Check-in → RFID/NFC → entry point → Reveal → Copy). The public anon key (if
your gateway SDK needs one) is safe to ship: it can only reach the tap RPC,
which validates the device key server-side.

## Concepts

- **Entry point** — a reader with a price (e.g. Dodgems gate, €5.00, charge
  every tap). The point's price/currency/mode are snapshotted onto every tap,
  so dashboard price edits never rewrite history.
- **Credential** — an NFC UID bound to an attendee in the dashboard. Unknown
  UIDs are **rejected** until bound (bind, then re-tap).
- **Billing modes** — `free` (admit only), `paid_every_tap` (bar/per-ride),
  `paid_once` (first tap bills, re-taps admit free).
- **Tap statuses** — `pending` (owes money), `settled`, `void`, `free`.

## 1. Provisioning check

Confirm a key maps to the right point before going live. Never returns the key.

```http
GET /api/nfc/tap?device_key=abc123…
X-NFC-Device-Key: abc123…        # header works too
```

```json
{ "ok": true, "point": {
    "id": "…", "name": "Dodgems gate", "location": "North field",
    "event_id": "…", "project_id": "…",
    "amount_cents": 500, "currency": "eur",
    "billing_mode": "paid_every_tap", "active": true } }
```

Errors: `401 MISSING_KEY / INVALID_POINT`, `409 POINT_INACTIVE`.

## 2. Record a tap

```http
POST /api/nfc/tap
Content-Type: application/json
```

```json
{
  "device_key": "abc123…",
  "nfc_uid": "A1B2C3D4",
  "idempotency_key": "reader7-000123",
  "tapped_at": "2026-09-08T18:02:11.000Z"
}
```

- Field names accept `snake_case` or `camelCase` (`deviceKey`, `nfcUid`, …).
- Key also accepted as `X-NFC-Device-Key` header.
- `idempotency_key` — **required for production readers.** Any string unique
  per tap attempt (reader-id + monotonic counter is ideal). Replays with the
  same key return the original receipt with `"deduped": true` and bill **once**.
- `tapped_at` — optional; defaults to server time. Send the reader's timestamp
  when replaying an offline buffer.

Success (`200`):

```json
{ "ok": true, "deduped": false,
  "admitted": true, "already_in": false,
  "tap_id": "…", "attendance_id": "…",
  "status": "pending", "amount_cents": 500, "currency": "eur",
  "attendee": { "name": "Ava Rao", "registration_id": "…" },
  "entry_point": { "id": "…", "name": "Dodgems gate" } }
```

Show green when `ok` is true. When `status` is `pending`, tell the guest the
amount owed (`amount_cents` / 100 in `currency`). `admitted:false` +
`already_in:true` just means they were already inside — the charge still
applies per the point's mode.

Business errors (all `{ "ok": false, "reason": "…" }`):

| HTTP | `reason` | Meaning → reader behaviour |
|---|---|---|
| 401 | `INVALID_POINT` / `MISSING_KEY` | Wrong key — red + "reader not provisioned" |
| 404 | `UNKNOWN_UID` | Unbound wristband — red + "go to registration desk"; staff bind, guest re-taps |
| 409 | `POINT_INACTIVE` | Point disabled in dashboard |
| 409 | `CREDENTIAL_INACTIVE` | Wristband disabled (lost/stolen) — confiscate flow |
| 409 | `TICKET_INVALID` | Gate/session points only: the holder's ticket was cancelled, refunded or declined — box office |
| 409 | `CAPACITY_FULL` | Gate points (and session points with a zone) only: the area is at its hard cap (Check-in → Capacity Control). Adds `zone`, `occupancy`, `cap` — red + "Full — please wait". Never returned for someone already inside |
| 400 | `MISSING_UID` / `INVALID_TAPPED_AT` | Reader bug — log and alert |
| 503 | `UNAVAILABLE` | Retry with backoff, keep the same `idempotency_key` |

## 3. Offline operation

1. Buffer taps locally with their `idempotency_key` + reader `tapped_at`.
2. On reconnect, POST in order, **same keys**.
3. `deduped:true` in a response means that tap was already recorded (your
   retry raced a success) — do not double-count, do not re-bill the guest
   display.

## 4. Reader UX cheat-sheet

- `2xx ok:true, status:pending` → green + "€5.00 added to your bill".
- `2xx ok:true, status:free` → green + "Enjoy!" (free point or re-entry).
- `404 UNKNOWN_UID` → red + "Unknown band — registration desk".
- `409 CREDENTIAL_INACTIVE` → red + "Band disabled — see staff".
- `409 CAPACITY_FULL` → red + "Full — please wait" (`zone`, `occupancy` / `cap` in the body). Readers can't override a cap; staff admit past it from the scanner with a supervisor code.
- `401/503` → red + "Reader offline — see staff"; keep buffering.

## 5. Test without hardware

- Dashboard: entry point card → enter a UID → **Test tap** (runs this exact
  endpoint end to end).
- cURL:

```bash
curl -X POST https://<your-app>/api/nfc/tap \
  -H 'content-type: application/json' \
  -d '{"device_key":"<key>","nfc_uid":"TEST01","idempotency_key":"t1"}'
```

## 6. Worked example — paid zone on the day

1. Organizer creates point "Rodeo bull — €3, charge once per guest", copies
   the device key onto the reader (provisioning `GET` confirms it).
2. At the merch desk a wristband `9F31AA` is bound to Ava (or bulk-imported
   via CSV before gates open).
3. Ava taps → reader POSTs → `200 pending 300 eur` → display "€3.00 added".
   She is admitted (attendance row, method `rfid`) and owes €3.00.
4. Ava taps again later → `200 free` → admitted, no new charge.
5. At exit Ava pays €3.00 at the till; staff mark the tap **Settled** in
   Pending bills. Disputed tap → **Void**; either can be **Reopened**.

## Limits

- ~500 most-recent taps per event are listed in the dashboard ledger (the
  table itself is unbounded).
- Rate: readers tap at human speed; no throttle is enforced, but keep
  `idempotency_key`s unique per attempt — key reuse across *different* taps
  would collapse them into one.
- Rotating a point's device key kills the old key instantly — re-provision
  readers right after rotating.

## 7. Smart Badges — entry-point purposes (additive)

Check-in → Smart Badges turns credentials into managed chip badges (serials,
batches, lost / revoked / replaced states, an activity timeline) and gives
every entry point a **purpose**. The endpoint, auth, request body and every
field above are unchanged; responses only gain fields. Existing points are
`gate`, which is exactly the behaviour described in sections 1–6.

| Purpose | A tap… | Charges? |
|---|---|---|
| `gate` | Admits at the door (presence row, deduped per badge holder) | Per billing mode |
| `session` | Checks the holder into the point's linked session | Never |
| `lead` | Saves the holder as a lead for the point's exhibitor, once per exhibitor + holder (repeat taps count visits) | Never |
| `payment` | Bills only — no presence row (bars, merch, rides) | Per billing mode |
| `info` | Logs the tap only (footfall, photo spots) | Never |

`paid_once` is now once per **holder**: a replacement badge doesn't pay again.

### Provisioning response additions

```json
{ "ok": true, "point": { "…": "…",
    "purpose": "lead",
    "session": null,
    "exhibitor": { "name": "Northwind Labs", "kind": "booth" } } }
```

`session` is `{ "id", "name" }` on session points; `exhibitor` is
`{ "name", "kind" }` on lead points; both are `null` otherwise.

### Tap response additions

```json
{ "ok": true, "…": "…",
  "purpose": "session",
  "outcome": "checked_in",
  "badge": { "id": "…", "serial": "EVT-0042", "status": "active" },
  "attendee": { "name": "Ava Rao", "registration_id": "…", "order_id": null },
  "entry_point": { "id": "…", "name": "Hall B doors", "purpose": "session" },
  "session": { "id": "…", "name": "Opening keynote", "already_in": false },
  "lead": null }
```

- `outcome` — `admitted` | `already_in` | `checked_in` | `lead_captured` |
  `lead_repeat` | `charged` | `free` | `logged`.
- `lead` — `{ "id", "new", "exhibitor" }` on lead points; `new:false` means
  this exhibitor already had the holder (show "Welcome back").
- `admitted` / `already_in` keep their meaning: a presence row was (or already
  was) recorded — at the door for gates, in the session for session points.

### Refusal additions

Refusals keep their `reason` and HTTP status and add `badge_status` when the
chip is known:

```json
{ "ok": false, "reason": "CREDENTIAL_INACTIVE", "badge_status": "lost" }
```

| `reason` | `badge_status` | Reader behaviour |
|---|---|---|
| `UNKNOWN_UID` (404) | `unassigned` | Spare badge not bound yet — registration desk |
| `CREDENTIAL_INACTIVE` (409) | `lost` / `revoked` | Red + "Badge disabled — see staff"; keep the badge |
| `CREDENTIAL_INACTIVE` (409) | `replaced` | Red + "Old badge — use your new one" |
| `TICKET_INVALID` (409) | `active` | Red + "Ticket not valid — box office" (also returns `attendee.name`) |
| `CAPACITY_FULL` (409) | `active` | Red + "{zone or Venue} full — please wait"; no charge is taken. Also returns `attendee.name`, `zone` (`""` = the venue), `occupancy`, `cap` |

Every refusal of a known chip is logged on that badge's timeline, deduped by
`idempotency_key` like taps.

### UIDs

UIDs match case-insensitively with separators ignored: `04:a2:1f:9c`,
`04-A2-1F-9C` and `04A21F9C` are the same chip. Send the reader's raw hex.
