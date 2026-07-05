# Check-in Module — Phase 2: Staff Routes (Design)

Status: in progress. Date: 2026-07-06. Follows Phase 1
(`2026-07-05-checkin-module-design.md`), which built the workspace screens, data
layer, and per-event editor toggles. Phase 2 builds the three staff-facing app
routes that actually admit attendees, reusing the Phase 1 data model.

## Decisions (defaults taken; open to review)

- **QR library:** jsQR — tiny, pure-JS, QR-only. Camera UI is built with
  `getUserMedia` + `<canvas>` so it matches the suite; jsQR decodes frames.
- **Routes:** three top-level full-screen routes —
  `/checkin/[eventId]` (scanner), `/kiosk/[eventId]` (self-service),
  `/door/[eventId]` (POS). Matches the `/checkin/<event>?code=` link already
  shown in the Check-in App settings screen.
- **Auth:** per-event **access code / PIN**. No suite login — routes are
  anonymous, gated by a code validated against `checkin_staff_roles.access_code`.
- **Door payment:** record-as-paid via the existing `buy_ticket` RPC (no Stripe),
  then auto-admit.
- **Kiosk depth:** full self-service — check-in + on-site register + buy —
  reusing `register()` / `buy_ticket()`, respecting the per-event kiosk config.

## The core problem & approach

`checkin_attendance` is member-only under RLS, so an **anonymous** staff route
cannot write it directly. Mirroring how public checkout already works
(`buy_ticket` / `register` are SECURITY DEFINER, granted to `anon`), Phase 2 adds
SECURITY DEFINER RPCs that **validate the access code server-side** and do the
lookup/admit/sell, so no broad anon RLS is opened.

### RPCs — `supabase/sqls/checkin_routes.sql`

Runs after `checkin.sql` (tables exist); all SECURITY DEFINER,
`search_path = events, public`, granted to `anon, authenticated`.

- `checkin_validate_code(p_event uuid, p_code text) → jsonb` — returns the
  matching active role `{ id, name, permissions }` for the event's project, or
  `null`. Every other RPC calls this first and raises on an invalid code.
- `checkin_search(p_event, p_code, p_query) → setof` — search the event's
  registrations by name / email / derived ticket code; each row carries a
  `checked_in` flag (an `in` attendance row exists). Limit 25.
- `checkin_admit(p_event, p_code, p_registration, p_order, p_name, p_ticket_code,
  p_gate, p_zone, p_session, p_method, p_staff) → jsonb` — validate, dedupe (if
  the registration already has an `in` row → `{ already: true }`), else insert
  `checkin_attendance` (project derived from the event) and return `{ ok: true,
  id }`.
- `checkin_stats(p_event, p_code) → jsonb` — `{ checkedIn, expected }` for the
  live counter.

Ticket code = `upper(substring(replace(id::text,'-',''),1,8))` — matches the
Phase-1 JS `ticketCode()` used on badges / name-search / the QR payload.

### Client wrappers — `lib/supabase/checkin.js`

Anonymous `createClient()` + `.rpc(...)`: `validateCheckinCode`, `searchCheckin`,
`admitCheckin`, `checkinStats`. Same pure contract (return data / null).

## Route UIs

Client components (like `/e/[id]`), full-screen, dark. Shared pieces in
`components/checkin_routes/`:

- `access_gate.jsx` — PIN entry → `validateCheckinCode` → on success stores the
  validated role in `sessionStorage` (keyed by event) and renders children;
  reads `?code=` from the URL to auto-unlock a shared link.
- `qr_scanner.jsx` — `getUserMedia` rear camera → `<canvas>` frame loop → jsQR;
  emits decoded text; graceful fallback + permission handling; torch/skip when
  unsupported.
- `route_shell.jsx` — full-screen shell: event name, live counter, exit.

### `/checkin/[eventId]` — scanner
Gate → scanner. A scanned QR (or a typed ticket #/name via manual search) resolves
through `checkin_search`, shows the match, and `checkin_admit` (method `qr` /
`manual`) admits — big success/duplicate/failure feedback and a running count.
Gate/zone/session pickers when the event has them.

### `/kiosk/[eventId]` — self-service
Gate (staff sets it up) → idle screen → attendee actions per the per-event kiosk
config: **self check-in** (scan/search → admit, method `self`/`kiosk`), **register**
(minimal form → `register()`), **buy** (pick ticket → `buy_ticket` → admit).
Tablet vs kiosk mode from the global setting. Returns to idle after each.

### `/door/[eventId]` — POS
Gate → pick ticket type + qty + payment method (cash/card/comp) + buyer name/email
→ `buy_ticket` (marked paid, no Stripe) → `checkin_admit` (method `door`) →
receipt. Respects the per-event Door Sales config + allowed methods.

## Non-goals (Phase 2)

Offline queueing (still under development), real Stripe at the door, hardware
RFID readers, native wallet-pass signing. These remain simulated/settings-only.

## Files

- `supabase/sqls/checkin_routes.sql`
- `lib/supabase/checkin.js` (append route wrappers)
- `components/checkin_routes/` — `access_gate.jsx`, `qr_scanner.jsx`, `route_shell.jsx`
- `app/checkin/[eventId]/page.js`, `app/kiosk/[eventId]/page.js`, `app/door/[eventId]/page.js`
- `package.json` — add `jsqr`
