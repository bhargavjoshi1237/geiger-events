# 13 — Analytics

| | |
|---|---|
| **Nav items** | 13 |
| **Registered** | **1/13** — only Scheduled Reports. Sales, Attendance, Cross-event Reporting, Traffic & Sources, Email Performance, Engagement, Sponsor ROI, Real-time Dashboards, Conversion Funnels, Revenue Forecasting, Surveys & NPS and Demographics are all `ComingSoon` |
| **Tier** | **C — label-only** (and the one screen that exists sends nothing) |
| **Blocked by** | [00 H1 jobs](00-cross-cutting.md) for delivery, [00 H2 send stack](00-cross-cutting.md) for email metrics, [00 H3 fees](00-cross-cutting.md) for net revenue |

> **The cheapest big win in the product.** Unlike [04](04-event-design.md) or
> [15](15-advertising.md), the *data already exists* — orders, registrations,
> check-ins, sessions, seats and inventory are all real, populated tables. Twelve
> dead screens are twelve SQL queries and twelve charts away from being live.
> `recharts` is already a dependency and is barely used.

---

## 1. What this means in industry

- **Sales** — gross/net/refunded revenue over time, by ticket type, by channel,
  with pacing against capacity and against a comparable past event.
- **Attendance** — registered → attended conversion, no-show rate, arrival curve
  by 15-minute bucket (this is how staffing decisions get made), session attendance.
- **Traffic & sources** — where buyers came from (UTM, referrer, direct, social),
  and revenue attributed per source.
- **Conversion funnels** — page view → ticket select → checkout start → paid, with
  the drop-off at each step; abandoned-cart value.
- **Email performance** — delivered/open/click/bounce/complaint per campaign.
- **Engagement** — sessions attended, chat/poll/Q&A participation, dwell time.
- **Sponsor ROI** — impressions, booth scans, leads, and cost-per-lead per sponsor.
- **Cross-event reporting** — the same metrics across a portfolio, with benchmarks.
- **Forecasting** — projected final attendance and revenue from the current curve.
- **Demographics & NPS** — who came, and did they like it.
- **Scheduled reports** — all of the above, generated and emailed on a cadence.

## 2. What exists today (verified)

- **Scheduled Reports** is a record set on `events.analytics_records` — you can define a
  report (type, frequency, format, recipients) and **nothing generates or sends it**
  ([00 H1](00-cross-cutting.md) + [00 H2](00-cross-cutting.md))
- `analytics/modules.jsx` states the position plainly: "the remaining Analytics items are
  read-only dashboards (charts) and are intentionally not modelled as records here"
- **No event/traffic instrumentation exists at all** — no page-view, checkout-start, or
  source capture anywhere in the public event page, so Traffic & Sources and Conversion
  Funnels have no data source even in principle

## 3. Pending deliverables

### P0 — Build the four dashboards whose data already exists
No new instrumentation needed; these are queries over existing tables.

- [ ] **Sales** — revenue over time, by ticket type, by event; gross/refunded/net (net after [00 H3](00-cross-cutting.md)); pacing vs capacity
- [ ] **Attendance** — registered vs attended, no-show rate, **arrival curve by 15-min bucket**, per-gate breakdown
- [ ] **Cross-event Reporting** — the portfolio table: per event revenue, sell-through, attendance rate, sortable and exportable
- [ ] **Real-time Dashboards** — live sales + arrivals for an in-progress event, auto-refreshing, with a full-screen mode for the ops desk
- [ ] A shared `lib/analytics/queries.js` so Overview ([01](01-overview.md)) and these screens read the *same* definitions — two definitions of "revenue" is worse than none

### P1 — Add the instrumentation the rest need
- [ ] `events.page_events` (event_id, kind, session_id, utm jsonb, referrer, created_at) written from `/e/[id]` — this single table unlocks **Traffic & Sources** and **Conversion Funnels**
- [ ] Capture UTM at first touch and persist it onto the order, so revenue attribution is possible
- [ ] **Conversion Funnels** and **Traffic & Sources** screens
- [ ] **Engagement** from existing chat/poll/Q&A/session data
- [ ] Make **Scheduled Reports** real: a job generates the report, renders CSV/PDF, and sends it

### P2
- [ ] **Sponsor ROI** (needs booth scans + leads from [12](12-checkin.md)/[21](21-sponsors-expo.md))
- [ ] **Email Performance** (needs a send log from [00 H2](00-cross-cutting.md))
- [ ] **Surveys & NPS** (needs real survey responses from [18](18-community.md))
- [ ] **Revenue Forecasting** and **Demographics**

### P0 alternative
- [ ] If these won't be built soon, **cut the section to 3 entries** (Sales, Attendance, Scheduled Reports) and delete the rest. Twelve `ComingSoon` screens under one heading is the clearest single signal of vapor in the app.

## 4. UX & component placement

Since there is nothing to critique, this is the pattern to build to — and the
**most important decision is to establish one dashboard layout and reuse it**,
rather than letting twelve screens diverge.

### The standard analytics frame
```
ScreenHeader  ─ title + description
              └ actions: [Event scope ▾] [Date range ▾] [Compare ▾] [Export]
StatsBar      ─ 4 KPIs, each with delta + trend vs the comparison period
SectionCard   ─ the primary time-series chart (full width)
2-col grid    ─ breakdown chart  |  breakdown table (same data, two readings)
SectionCard   ─ the detail table, sortable, exportable
```

Placement rules that matter:
- **Scope controls live in the header, never in the body.** Every chart on the page must obey the same event scope and date range; per-card ranges (as on [01 Overview](01-overview.md) today) make numbers non-comparable and are the classic dashboard mistake.
- **Every chart pairs with a table.** Charts answer "what's the shape"; tables answer "what exactly" and are what people copy into a deck. Ship both, never a chart alone.
- **Comparison is a first-class control**, not a checkbox — "vs previous period" and "vs a chosen past event" are the two comparisons organizers ask for.
- **Export lives in the header** and exports *the current scoped view*, not the raw table.
- **Empty states must distinguish "no data yet" from "no instrumentation"** — if traffic tracking isn't wired, say that plainly rather than showing an empty chart, or the user will assume the product is broken.
- Use `dataviz` guidance for colour: one categorical palette shared across all twelve screens, semantic tokens only ([00](00-cross-cutting.md) — and note [01](01-overview.md) currently hardcodes hex, which must not be copied).

### Real-time Dashboards specifically
- No date range (it's *now*); instead a live indicator with last-updated
- Large-format typography — this screen goes on a wall
- Arrivals-per-minute and sales-per-minute as the two hero numbers

### Scheduled Reports
- Keep the record list, but add a **"Last run" column with status** and a "Run now" row action. A schedule you cannot test or verify is not a schedule
- Preview the report output in a drawer before saving

## 5. Schema / API work
- [ ] `events.page_events` + index on `(event_id, created_at)`
- [ ] `events.v_event_sales_daily`, `v_event_attendance`, `v_project_portfolio` — one view per dashboard so the SQL isn't inline in components
- [ ] `order.utm jsonb` for attribution
- [ ] Job kind: `analytics.scheduled_report`
