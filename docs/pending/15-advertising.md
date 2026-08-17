# 15 — Advertising

| | |
|---|---|
| **Nav items** | 4 — Connections, Ad Campaigns, Budgets, Insights |
| **Registered** | 4/4 |
| **Tier** | **C — the most misleading section in the app** |
| **Key files** | `advertising/connections.jsx`, `screens.jsx`, `insights.jsx`, `demo_insights.js`, `lib/supabase/advertising.js` |

> Every other Tier-B section at least stores the organizer's real intent. This
> one **renders bundled demo data as if it were live performance**, which also
> violates the project's own rule in `SUPABASE_CONVENTIONS.md` ("There is no
> sample-data fallback — an unconfigured/empty DB renders the empty state").

---

## 1. What this means in industry

A paid-ads layer over Google Ads / Meta Ads (or a wrapper like Metadata, AdRoll)
must do four things, and the value is entirely in 2–4:

1. **Connect** — real OAuth to the ad account, token refresh, account/property selection.
2. **Push** — create or sync campaigns, ad sets, creatives and budgets *into* the platform.
3. **Pull** — fetch spend, impressions, clicks and conversions on a schedule.
4. **Attribute** — a conversion pixel (or offline conversion upload) tying ad spend to
   actual ticket revenue, producing ROAS and cost-per-acquisition.

Without #4 an ads module can't answer the only question anyone asks: *did the
advertising sell tickets?*

## 2. What exists today (verified)

- **Connections** — a dialog collecting account fields by hand. The code says so
  plainly: each connection's config "holds the account fields a live OAuth sync would
  later fill." **No OAuth, no API client, no token storage, no refresh.**
- **Ad Campaigns / Budgets** — generic record sets on `events.advertising_records`.
  Numbers (spend, impressions, clicks) are **typed in by the user**.
- **Insights** — a dashboard aggregating those hand-typed numbers, and seeded with
  `DEMO_CAMPAIGNS` from `advertising/demo_insights.js` when empty.
- **No pixel, no conversion tracking, no ROAS.** Nothing connects an ad to a ticket sale.

Net: it is a spreadsheet for ad numbers you already know, presented as a
platform integration.

## 3. Pending deliverables

### P0 — Choose one of two honest paths
This section cannot stay as-is; either commit to the integration or reframe it.

**Path A — make it real (large):**
- [ ] OAuth for Google Ads and Meta Ads: consent flow, encrypted token storage, refresh, account selection
- [ ] Scheduled metric pull into `advertising_records` (needs [00 H1](00-cross-cutting.md))
- [ ] A conversion pixel on `/e/[id]` + purchase event, or offline conversion upload from orders
- [ ] ROAS / CPA on Insights, computed from real spend against real order revenue

**Path B — reframe as manual tracking (small, honest):**
- [ ] Rename to **"Ad Tracking"**; state in every header description that figures are entered manually
- [ ] **Delete `demo_insights.js`** and render a proper empty state
- [ ] Keep Budgets (a real planning tool) and drop Connections entirely — a "connection" that connects to nothing is indefensible

### P0 regardless of path
- [ ] **Remove the demo-data fallback.** Shipping fabricated performance numbers is the single most credibility-damaging line of code in the repo

### P1 (Path A only)
- [ ] Creative management + preview
- [ ] Budget pacing alerts (spend vs. plan vs. days remaining)
- [ ] Audience push: send a [07 Segment](07-guests.md) to Meta/Google as a custom audience — this is the genuinely useful integration and it reuses `lib/audience/resolve.js`

## 4. UX & component placement

### Connections
| Issue | Change |
|---|---|
| Platform cards imply an OAuth connection that doesn't happen | Until Path A lands, the card's action must read **"Add account details"**, not "Connect", and the card must show a `Manual` badge. Wording is doing real work here |
| Status pills suggest live sync health | Replace with `Last updated <date> · manual` |
| Four platforms all look equally supported | If only some will ever be built, show the rest as an explicit "Planned" group rather than actionable cards |

### Insights
| Issue | Change |
|---|---|
| Demo data renders on an empty workspace | Replace with an `EmptyState` that explains where numbers come from and links to Ad Campaigns |
| Metrics are platform-centric (impressions, clicks, CTR) | Lead with the **organizer's** metrics: spend, tickets sold, revenue, ROAS, cost per ticket. Impressions belong in a secondary row. An event platform's ads screen should answer "did this sell tickets", not "did this get seen" |
| No time scope | Add the shared date range to `ScreenHeader.actions`, consistent with [13 Analytics](13-analytics.md) |

### Ad Campaigns / Budgets
| Issue | Change |
|---|---|
| Two separate record screens for things that are one concept | Merge: a budget is a property of a campaign (or of a campaign group). Two sidebar entries for one object is padding |
| Manual number entry is tedious and error-prone | If staying manual, add a **bulk paste/import** ("paste your Google Ads export") — far more realistic than typing weekly figures into a form |
| No link to the event being advertised | Every ad campaign should reference an event and show that event's ticket sales alongside the spend. Without it, the section is disconnected from the product |

## 5. Schema / API work
- [ ] Path A: `events.ad_connections` (platform, account_id, encrypted tokens, expires_at, last_synced_at) and `events.ad_metrics_daily` (connection_id, campaign_ref, date, spend, impressions, clicks, conversions)
- [ ] Conversion attribution: reuse `order.utm` from [13 P1](13-analytics.md) rather than inventing a second attribution path
- [ ] Job kind: `ads.sync_metrics`
