# 01 — Overview

| | |
|---|---|
| **Nav items** | 1 (no sub-items) |
| **Registered** | 1 — `overview/events_overview.jsx` (852 lines) |
| **Tier** | **C — the dashboard is fabricated** |
| **Blocked by** | [00 H1 job runner](00-cross-cutting.md) for trends; nothing else |

> **This is the highest-priority item in the entire audit.** Overview is the
> first screen a user sees, and almost every number on it is a hardcoded
> constant. Whatever else is true about the product, the first impression is
> fabricated — which is the fastest possible way to make real features look fake.

---

## 1. What this means in industry

An event-platform home is a **decision surface**, not a poster. Eventbrite
Organizer Home, Cvent Dashboard and Hopin Overview all do the same four jobs:

- **Time-scoped KPIs** — registrations, gross/net revenue, check-in rate, page
  conversion, each against a selectable range and a prior-period comparison.
- **Attention queue** — what needs a human *today*: events on sale with zero
  sales, refunds awaiting approval, waitlists with freed capacity, failed
  payouts, unanswered messages. Each row deep-links to the exact screen.
- **Trajectory** — sales pacing vs. capacity and vs. the same point in a
  comparable past event; a forecast of final attendance.
- **Portfolio view** — top events by revenue/sell-through, with drill-down.

## 2. What exists today (verified)

Real:
- `listEvents(projectId)` on mount (`events_overview.jsx:753`) — the event list
  and its status grouping are genuine.

Hardcoded constants, rendered as if live:
- `STATS` (line 81) — "1,284 registrations", "$24,860 revenue", "962 check-ins",
  and their `+12.5% / +8.2% / +5.1% / -3.4%` deltas
- `TREND_SERIES` (88) — the whole chart
- `TICKET_MIX` (100), `CONVERSION_FUNNEL` (108)
- `SELL_THROUGH` (116), `ATTENDANCE` (117)
- `TOP_EVENTS` (120), `ATTENTION_ITEMS` (142)

Also: `CHART_COLORS` / `CHART_SERIES_COLORS` (65, 70) are **hardcoded hex**,
which `CLAUDE.md` and `crafting.md` both forbid ("semantic tokens only, never
hardcode hex").

## 3. Pending deliverables

### P0 — Make every number real or remove it
- [ ] `lib/supabase/overview.js` (or a set of Postgres views) returning, per project + date range: registrations, gross revenue, net revenue, refunds, check-ins, check-in rate, sell-through
- [ ] Replace `STATS` with the fetched result; keep `RollingNumber` for the animation
- [ ] Replace `TREND_SERIES` with a real daily series (`date_trunc('day', created_at)` over orders + registrations)
- [ ] Replace `TICKET_MIX` with a group-by over order line items; `CONVERSION_FUNNEL` with page-view → checkout-start → paid (needs the traffic events from [13 Analytics](13-analytics.md))
- [ ] Replace `TOP_EVENTS` with a real ranking, sortable by revenue / sell-through / attendance
- [ ] **Delete any tile whose data source doesn't exist yet** rather than shipping a placeholder number. An honest four-tile dashboard beats a fabricated eight-tile one.
- [ ] Replace the hex chart colors with semantic tokens / CSS variables

### P1 — Make the attention queue real
- [ ] Derive `ATTENTION_ITEMS` from live queries: events publishing in <7 days with 0 sales; refunds in `Requested`; waitlists with freed capacity; disputes needing response; unread portal threads
- [ ] Each item deep-links via `useWorkspaceUrl()` to the screen *and* the filtered state that resolves it

### P2 — Forecasting and comparison
- [ ] Pacing vs. a comparable past event
- [ ] Final-attendance forecast from the registration curve
- [ ] Empty-workspace onboarding path (first event → first ticket → publish)

## 4. UX & component placement

**Current frame:** a bespoke dashboard (no `ScreenHeader`), `StatsBar` at line
804, three inline `FilterDropdown`s scattered at 216 / 313 / 544.

| Issue | Change |
|---|---|
| No `ScreenHeader` — the screen has no title, description, or action slot, so it doesn't match any other screen in the suite | Add `ScreenHeader` with the project name + "Here's what needs you today", and put the **global date-range picker** in `actions` |
| Three separate `FilterDropdown`s control three different cards, at three different scroll positions | Replace with **one date range in the header** that scopes the whole page. Per-card controls should only exist for genuinely card-local choices (e.g. Top Events sort), and should sit in that `SectionCard`'s `action` slot, not float in the body |
| KPI tiles are inert | Make each tile navigate to its section pre-filtered (Revenue → Orders filtered to the range; Check-ins → Real-time Attendance) |
| Attention items are below the charts | **Move the attention queue directly under the stats bar, above the charts.** Charts are for orientation; the queue is the reason to open the page. This is the single biggest layout win here |
| Stats bar is 4 tiles of equal weight | Lead with the two that drive decisions (Revenue, Sell-through); demote Check-ins to the attendance card where its context lives |
| No loading state — constants render instantly, so the real version will pop | Add skeleton tiles and a skeleton chart while the first fetch resolves |

**Proposed order:** `ScreenHeader (+ date range)` → `StatsBar (4, clickable)` →
`Needs attention` (list, urgency-sorted, deep-linked) → `Sales trend` (chart) →
two-column: `Ticket mix` + `Conversion funnel` → `Top events` (table with sort in
the card's action slot) → `Upcoming schedule`.

## 5. Schema / API work

- [ ] `events.v_project_daily_metrics` — a view aggregating orders, registrations and check-ins by day + project, so every KPI reads one place
- [ ] Index `created_at, project_id` on `event_orders`, `registrations`, `checkins`
- [ ] Consider a nightly rollup table once the view gets slow (a [00 H1](00-cross-cutting.md) job)
