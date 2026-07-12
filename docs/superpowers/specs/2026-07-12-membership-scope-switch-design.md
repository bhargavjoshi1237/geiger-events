# Membership scope switch + per-event membership section

**Date:** 2026-07-12
**Status:** Awaiting review

## Problem

A membership plan carries a `discountPercent` ("Member discount") that is
conceptually applied across **all** events. Two gaps:

- There is no way to scope a plan to specific events. The all-events behaviour is
  implicit and always-on.
- Applying a membership's discount to every event is the **rare** case. The common
  case an organizer wants is: "make this membership available on *these* events."

Note: the member discount is **not** wired into any checkout/pricing math today —
`discountPercent` is purely config surfaced in the plan summary. This feature is a
config + UI scoping change, not a pricing change.

## Solution

Introduce an explicit **scope switch** on each membership plan, and a dedicated
**Memberships** section in the event editor for the per-event case.

### 1. Plan config — one new flag

Add `applyToAllEvents: false` to `defaultMembershipPlanConfig` (in
`components/internal/screens/tickets/constants.js`). It lives in the existing
`ticketing_records.config` jsonb bag, so **no SQL migration is needed**; existing
plans read `false` via `config.applyToAllEvents ?? false`.

Semantics:

- **OFF (default)** — per-event opt-in. The plan does not apply anywhere until it
  is enabled on a specific event's Memberships section.
- **ON (rare)** — the plan's member discount applies to **all** events
  automatically; it is not listed as a per-event toggle.

### 2. Plan edit form — Scope switch

In `components/internal/screens/memberships/membership_plans.jsx`
(`MembershipPlanEditForm`), add a **"Scope"** `SectionCard` with a
`SettingsList` / `SettingRow` toggle:

- Title: *"Apply to all events"*
- Description: *"Turn on to apply this membership's discount across every event.
  Most plans stay off and are enabled per event."*
- `checked={!!config.applyToAllEvents}`, `onCheckedChange={(v) => set({ applyToAllEvents: v })}`

Update `summarize(r)` to append `· All events` when `config.applyToAllEvents` is
true (e.g. `"$99/yearly · 10% member discount · All events"`).

### 3. New event-editor section — Memberships

New file `components/internal/screens/events/event_memberships.jsx` exporting
`EventMembershipsSection`. Modelled on `TicketAttachmentsSection`
(`tickets/event_attachments.jsx`) and `OfferingsSection` (`events/offerings.jsx`).

Behaviour:

- Reads project membership plans:
  `listRecordsByModules(projectId, ["membership"])` → filter `active` plans.
- Enabled plan ids persist under the event metadata via
  `useEventConfig(event, "attached", {})`, using the `membership` key
  (`attached.membership` = array of plan ids) — the same key the generic attach
  used, so any prior selection carries over.
- **Per-event plans** (`config.applyToAllEvents` false): rendered as cards, each
  showing name, price/billing (`currency` + billing period), and discount
  (read-only), with an enable **toggle** (Switch). Toggling adds/removes the id
  from `attached.membership`.
- **Global plans** (`config.applyToAllEvents` true): rendered in a small
  read-only informational banner ("Applies to all events automatically") listing
  their names — no toggle. Omitted entirely if there are none.
- States: loading spinner while fetching; empty state (no plans at all) with a
  "Create one" button that `setTab("Membership Plans")`; filtered-empty (all
  plans are global) shows only the banner.

Read-only price/discount — no per-event override in this iteration (YAGNI).

### 4. Register the section

In `components/internal/screens/events/event_sections.js`:

- Import `EventMembershipsSection`.
- Add a `NAV_GROUPS` item under the **Tickets** group:
  `{ key: "memberships", label: "Memberships", icon: BadgeCheck, desc: "…", ownHeader: true }`.
- Map `memberships: EventMembershipsSection` in `SECTIONS`.

### 5. De-duplicate the generic attach list

In `components/internal/screens/tickets/event_attachments.jsx`, remove the
`membership` entry from `ATTACH_MODULES` so memberships are managed only in their
dedicated section (avoids two surfaces writing `attached.membership`).

## Files touched

| File | Change |
|---|---|
| `components/internal/screens/tickets/constants.js` | add `applyToAllEvents: false` to `defaultMembershipPlanConfig` |
| `components/internal/screens/memberships/membership_plans.jsx` | Scope switch; `summarize` appends `· All events` |
| `components/internal/screens/events/event_memberships.jsx` | **new** dedicated section |
| `components/internal/screens/events/event_sections.js` | import + `NAV_GROUPS` entry + `SECTIONS` map |
| `components/internal/screens/tickets/event_attachments.jsx` | remove `membership` from `ATTACH_MODULES` |

## Out of scope

- Wiring the discount into checkout/pricing math (not wired today; unchanged).
- Per-event override of price or discount.
- Public event page rendering of memberships.

## Open questions (defaults taken while user away)

1. Switch default — **OFF = per-event** (global is the rare, explicit case).
2. Event surface — **new dedicated section** (vs. enhancing the generic card).
3. Per-event price/discount — **read-only display + toggle** (no override).

Revisit if the user prefers otherwise.
