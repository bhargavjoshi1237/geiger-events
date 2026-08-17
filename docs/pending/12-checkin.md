# 12 — Check-in

| | |
|---|---|
| **Nav items** | 17 |
| **Registered** | 15/17 — **Capacity Control** and **Smart Badges** are `ComingSoon`; **Offline Check-in** is a themed "in development" surface with no engine |
| **Tier** | **A — live** (the second-strongest area after commerce) |
| **Key files** | `app/checkin/[eventId]`, `app/door/[eventId]`, `app/kiosk/[eventId]`, `components/checkin_routes/qr_scanner.jsx`, `checkin/badge_printing.jsx` (525) + `lib/passes/*`, `checkin/staff_scanning_roles.jsx` (564), `lib/supabase/checkin.js` |

---

## 1. What this means in industry

Check-in (Cvent OnArrival, Zkipster, Eventbrite Organizer app) is judged on one
axis: **does it work when the venue's network doesn't?** Everything else is
secondary.

- **Offline-first** — the device caches the full guest list, admits without a
  connection, queues locally, and reconciles on reconnect with cross-device
  de-duplication so one ticket can't enter twice through two doors.
- **Speed** — sub-second scan-to-decision, name-search fallback, big
  unmistakable feedback states.
- **Badging on demand** — print a badge at the kiosk the moment someone arrives,
  on a real badge printer (Zebra/Brother/Dymo), not an office laser.
- **Hardware** — RFID/NFC encoding and reading for touchless entry and session
  tracking.
- **Zones & capacity** — multi-gate, per-zone entitlements, live occupancy with
  hard caps for fire code.
- **Lead retrieval** — exhibitors scan badges, capture qualifiers, and export to
  their CRM.

## 2. What exists today (verified)

Genuinely strong, and better than the sidebar implies:
- **A real working scanner** — `/checkin/[eventId]` with `jsqr` camera scanning, admit,
  live stats, session/gate/zone selection, code-gated access, clear success/duplicate/error
  feedback states
- **Door sales** and **kiosk** as separate staff routes
- **Badge printing is real** — a full pass designer (canvas, layers rail, inspector,
  per-face design, tier binding), paging through the **real attendee list**, with
  `printPasses()` and a zip export (`lib/passes/*`). This is a substantial build,
  not a settings form
- Real-time attendance, name-search lookup, staff scanning roles (564 lines), multi-gate
  & zones, self check-in, session check-in, wallet passes, RFID/NFC config

Gaps:
- **Offline check-in does not work offline.** The screen is honest about it
  ("intentionally under active development") and even lists the four planned
  capabilities — but this is *the* event-day failure mode, and it is unbuilt
- **Capacity Control** is `ComingSoon` — so zones exist but occupancy caps don't
- **Smart Badges** is `ComingSoon`
- **RFID/NFC is a settings form** (171 lines) with no encoder or reader integration
- Badge printing targets the browser print dialog — fine for sheet stock, but there is
  no direct **badge-printer** path (Zebra ZPL / Brother) and no print-at-kiosk-on-arrival flow
- **Lead Retrieval** (191 lines) captures leads but has no CRM export or qualifier form

## 3. Pending deliverables

### P0 — Offline (the one that matters)
- [ ] Cache the event's guest list to IndexedDB when the scanner route loads
- [ ] Admit against the local cache; write to a local queue with a client-generated id
- [ ] Background sync on reconnect; server resolves duplicates by ticket id and returns
      authoritative outcomes, so a ticket admitted on two offline devices is flagged
- [ ] Make offline state visible and trustworthy: a persistent banner with queued count,
      last-sync time, and a manual "sync now"
- [ ] Service worker so the route itself loads with no connection

### P1
- [ ] **Capacity Control**: live occupancy per zone with a hard cap, an override with reason,
      and an alert as capacity nears — register the screen
- [ ] Print-on-arrival: kiosk flow that prints the badge at check-in; ZPL output for Zebra
- [ ] Lead Retrieval: qualifier questions, exhibitor-scoped lead lists, CSV/CRM export
- [ ] Session check-in tied to [19 Agenda](19-program.md) sessions for per-session attendance
      (also feeds CEU credits)

### P2
- [ ] RFID/NFC read path (WebNFC where available; a companion reader otherwise)
- [ ] Smart Badges, or **remove the nav entry** — it currently promises hardware that isn't planned

## 4. UX & component placement

### Staff routes (`/checkin`, `/door`, `/kiosk`, `/issue`)
These are used **standing up, one-handed, in bad light, under time pressure**, and
they are already close. Refinements:

| Issue | Change |
|---|---|
| The scan target competes with stats and controls | **Camera fills the top 60% of the viewport**; controls (session/gate/zone) collapse into a single header chip that opens a sheet. Nothing but the feedback banner should ever overlay the camera |
| Feedback is a coloured banner | Keep the colour system (`FEEDBACK` in `app/checkin/[eventId]/page.js` is already right) but make it **full-width, high-contrast, and paired with a sound + haptic**. Staff should not need to read to know the outcome |
| Duplicate scans read as errors | Keep the distinct amber "already admitted" state and show **when and at which gate** it was first used — that's the question the guest will ask |
| Name search is a secondary field | Give it a dedicated large tab beside "Scan". Roughly a fifth of arrivals have no scannable ticket |
| Stats are decorative during a rush | Reduce to one number — **admitted / expected** — as a thin progress bar under the header |

### Badge Printing (the designer)
| Issue | Change |
|---|---|
| Canvas, layers rail and inspector need a stable spatial contract | Standardise on the same three-zone layout proposed for [04 Event Design](04-event-design.md): **layers left, canvas centre, inspector right**, header holds face switcher + Print/Export. Two canvas tools in the same app should not have mirrored layouts |
| Preview uses real attendees (good) but paging is buried | Put attendee paging **directly under the canvas** with a count (`3 of 412`) and a "jump to longest name" button — long names are what break badge layouts |
| Print and Export sit among other actions | Dock `[Print all] [Export ZIP]` in the header; add a **stock/margin preview** (which sheet, how many per page) before printing, since a bad print run wastes physical stock |

### Settings-style screens (QR, Wallet, App, Door, Kiosk, Session, RFID, Self, Gates)
| Issue | Change |
|---|---|
| Nine near-identical settings pages | Consider consolidating into **one "Check-in setup" screen with tabs**, leaving the operational screens (Real-time Attendance, Badge Printing, Lead Retrieval, Name-search, Staff Roles) as standalone. Nine settings pages for one feature is why the sidebar feels padded |
| Each configures a mode with no way to try it | Add a **"Open staff view"** button on each, launching the corresponding route in a new tab. Configuration you can't test is configuration nobody trusts |
| Per-project vs per-event scope is unclear | State it in the header description on every one of them: "Project default — each event can override in the event editor" |

### Real-time Attendance
- This is a **live dashboard**: make it auto-refresh, show arrivals-per-minute, and a gate breakdown. Add a full-screen mode — it will be put on a monitor at the ops desk

## 5. Schema / API work
- [ ] `events.checkins` gains `client_id uuid` (for offline dedupe) + a unique index on `(ticket_id, session_id)`
- [ ] `events.zone_occupancy` view for capacity control
- [ ] `events.leads` (exhibitor_id, contact_id, qualifiers jsonb, captured_at)
- [ ] Bulk guest-list endpoint sized for a full offline cache
