# NFC Paid Entry Points + Pass-Based Billing — Design

Status: approved. Date: 2026-09-08.

Adds **paid tap points** to the Check-in → RFID/NFC area: any physical spot
(ride gate, VIP zone, bar counter, activity desk) becomes an *entry point* —
a scanning device with its own price. When a guest's NFC wristband/card/pass
taps there, the attendee lands on a **pending bill** for X, settled later at
the till or desk. Includes the hardware-facing API the readers call.

Follows `2026-07-05-checkin-module-design.md` (Phase 1 tables + settings
pattern) and `2026-07-06-checkin-routes-phase2-design.md` (anonymous devices
via SECURITY DEFINER RPCs, never broad anon RLS).

## Goals

- Organizer creates entry points in the NFC section: name, location, price,
  currency, billing mode — each with a provisionable **device key**.
- Binding an NFC UID to an attendee (manual or CSV import). Unknown UIDs are
  rejected at the reader until bound.
- A tap bills a **pending** ledger line snapshotting the point's price at tap
  time (later price edits never rewrite history).
- Hardware integration over one HTTPS endpoint with idempotent retries, so
  offline-buffered readers can replay safely.
- Non-goals: charging cards at tap time (no Stripe on the reader — same
  record-as-pending model as Door Sales record-as-paid), per-tap inventory,
  native wallet-pass signing.

## Architecture

### Data model (`events` schema, migration `20260908000000_nfc_paid_entry.sql`)

| Table | Purpose | Key columns |
|---|---|---|
| `events.nfc_entry_points` | One row per scanning device/spot | `id, project_id, event_id, name, location, gate, zone, amount_cents, currency, billing_mode, active, device_key (partial-unique), metadata, timestamps, deleted_at` |
| `events.nfc_credentials` | NFC UID ↔ attendee binding | `id, project_id, event_id, registration_id, order_id, nfc_uid, label, active, …, unique(event_id, nfc_uid)` |
| `events.nfc_taps` | Billing ledger, one row per tap | `id, …, entry_point_id, credential_id, registration_id, nfc_uid, attendee_name, amount_cents, currency, status, billing_mode, idempotency_key, tapped_at, settled_at, attendance_id, unique(entry_point_id, idempotency_key)` |

Money is **minor units** (`amount_cents` integer) + ISO `currency`. Every tap
copies the point's amount/currency/mode — the ledger is an audit trail, not a
live join.

- **Billing modes** (`billing_mode`): `free` (admit only, tap stored as
  `free`), `paid_every_tap` (bar items, per-ride), `paid_once` (first tap per
  credential bills; re-taps admit free — paid zones).
- **Tap lifecycle** (`status`): `pending → settled | void`, plus `free`.
  "Pending bill" = `sum(pending)` grouped per attendee (`summarizeBills`).
- Entry points are **per-event** (`event_id` required, `project_id`
  denormalized like `event_orders`). The project-level `checkin_settings`
  `rfid` slice keeps only medium/range/checksum + a `billingCurrency` default
  for the create form.
- Demo-open RLS mirrors the other check-in tables; member scoping is
  finalized in `zz_project_access.sql`.

### The tap path (single writer)

```
reader → POST /api/nfc/tap { device_key, nfc_uid, idempotency_key? }
        → events.nfc_tap()  [SECURITY DEFINER, granted to anon]
            1. authenticate point by device_key (+ active?)
            2. idempotency: (point, key) seen? → return original, deduped:true
            3. resolve UID → credential (same event, active?)
            4. price decision from point config (paid_once: prior
               pending/settled tap for this credential+point? → free re-entry)
            5. presence: registration without an `in` attendance row?
               → insert checkin_attendance (method `rfid`, gate = point gate
               or name, checked_in_by `nfc:<point>`)
            6. insert nfc_taps with the snapshot → return receipt
```

Attendance stays **presence** (first tap admits; later taps reuse the row, so
Real-time Attendance distinct-counts never inflate) while **taps stay money**
(every tap bills per mode). Unknown UID → `{ ok:false, reason:UNKNOWN_UID }`
(hardware shows red; staff bind the band and re-tap). Unknown/inactive key →
`INVALID_POINT` / `POINT_INACTIVE`.

### API surface

- `POST /api/nfc/tap` — the only call a reader needs. Accepts snake_case or
  camelCase, key via body or `x-nfc-device-key` header. Status mapping: 200
  receipt (incl. `deduped` replays), 401 bad key, 404 unknown UID, 409
  inactive point/credential, 503 no DB. Permissive CORS (key-authenticated
  machine API).
- `GET /api/nfc/tap?device_key=…` — provisioning check for installers;
  returns point/event/price/mode, never the key.
- No service-role key anywhere on this path: the route builds an **anon**
  client and the RPC enforces auth, exactly like `checkin_admit`.

### Workspace UI (`components/internal/screens/checkin/rfid_nfc.jsx`)

Inside the existing `RfidNfcScreen` enabled branch (nothing existing moves):

1. **Paid entry defaults** — `billingCurrency` default (snapshot-on-create
   semantics documented inline).
2. **Paid entry points** — event picker → point cards (name, mode + amount
   badges, location, device-key reveal/copy/**rotate**, inline **Test tap**
   that runs the real API path) + create/edit dialog + delete (ledger kept).
   Warns when the event's `checkinDoorKiosk.rfid` toggle is off.
3. **Wristband bindings** — attendee search + UID bind, enable/disable,
   unbind, CSV import (`nfc_uid` + `ticket_code|email|name`; recycled UIDs
   re-bind by upsert).
4. **Pending bills** — StatsBar (pending/settled/taps) + open-bills table +
   tap ledger with status filter, search, settle/void/reopen.

Data layer `lib/supabase/nfc.js` follows the area convention (normalize/
toRow, pure, `null`/`false` returns). Shared bits in `constants.js`:
`NFC_BILLING_MODES(+HINTS)`, `NFC_CURRENCY_OPTIONS`, `NFC_TAP_STATUS_MAP`,
`formatMoney`, `genDeviceKey`.

### Settlement

Deliberately manual in v1: organizer settles/voids in Pending bills (or
takes cash/card at an external terminal and marks settled). The `settled_at`/
`settled_by` columns and `status` transitions are the seam a future Stripe
Terminal / exit-gate auto-settle builds on — no schema change needed.

## Files

- `supabase/migrations/20260908000000_nfc_paid_entry.sql`
- `lib/supabase/nfc.js`
- `components/internal/screens/checkin/constants.js` (billing constants)
- `components/internal/screens/checkin/rfid_nfc.jsx` (points + bindings + bills)
- `app/api/nfc/tap/route.js`
- `docs/nfc-hardware-api.md` (reader integration contract)
