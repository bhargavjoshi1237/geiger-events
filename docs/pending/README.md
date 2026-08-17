# Pending Deliverables

One file per sidebar section. Each file answers three questions:

1. **What does this feature mean in industry-standard apps?** (the bar the name sets)
2. **What actually exists here today?** (verified against the code, with file refs)
3. **What is pending?** (P0/P1/P2 deliverables + UX and component-placement fixes)

Written 2026-08-16 against `main`. Supersedes `docs/sidebar-feature-plan.md`,
which is stale (it still says "Events is the only live area").

---

## How to read the status tiers

| Tier | Meaning |
|---|---|
| **A — Live** | Works end-to-end. Data is written *and* something reads it at runtime. Would survive a real event. |
| **B — Config-only** | The screen saves a record, but no runtime consumes it. The feature is authored, not enforced. |
| **C — Label-only** | `ComingSoonScreen`, a folded banner, or demo data. The sidebar entry is the whole feature. |

The core finding: **the money path is Tier A; most of the periphery is Tier B.**
Tier B is the reason the app reads as gimmicky — a screen that lets you configure
anti-scalping but never blocks a scalper is worse than no screen, because it
makes a promise the product cannot keep.

---

## Section index

| # | Section | Tier | Nav items | Registered | Headline gap |
|---|---|---|---|---|---|
| [00](00-cross-cutting.md) | **Platform / cross-cutting** | — | — | — | No job runner, no send stack, no fees/tax, no webhooks, no audit log, no bulk actions |
| [01](01-overview.md) | Overview | A | 1 | 1 | Static KPI values; no date range |
| [02](02-events.md) | Events | A | 4 | 4 | No RRULE recurrence, no timezone normalization, no localization |
| [03](03-venues.md) | Venues | A | 1 | 1 | Not connected to Event Design |
| [04](04-event-design.md) | Event Design | **C** | 8 | **0** | Entire section is ComingSoon — despite two map editors already existing |
| [05](05-sourcing.md) | Sourcing | B | 4 | 2 | No RFP → bid → contract loop (that loop *is* the product) |
| [06](06-registrations.md) | Registrations | A/B | 6 (+10 folded) | 6 | Waitlist auto-promotion needs the job runner |
| [07](07-guests.md) | Guests | A | 8 | 8 | No bulk actions, no CSV export pipeline |
| [08](08-tickets.md) | Tickets | A/B | 20 | 20 | **No fees, no tax, no payouts, no multi-currency**; 8 rule screens enforce nothing |
| [09](09-orders.md) | Orders | A/B | 6 | 6 | Refunds are record-only — no Stripe refund is issued |
| [10](10-inventory.md) | Inventory | A | 6 | 6 | No costing/COGS, no reorder points, no barcode |
| [11](11-memberships.md) | Memberships | B | 3 | 3 | One-time payment, not a subscription — no renewal or dunning |
| [12](12-checkin.md) | Check-in | A | 17 | 15 | Offline check-in does not work offline (the #1 event-day failure) |
| [13](13-analytics.md) | Analytics | **C** | 13 | **1** | 12 of 13 screens don't exist; the data does |
| [14](14-campaigns.md) | Campaigns | **B** | 8 | 8 | No send stack at all — 3 of 61 email types are live |
| [15](15-advertising.md) | Advertising | **C** | 4 | 4 | No OAuth, no API sync; Insights renders bundled demo data |
| [16](16-workflows.md) | Workflows | **B** | 3 | 3 | No executor — nothing has ever written a `workflow_run` |
| [17](17-discovery.md) | Discovery | B | 1 | 1 | Profile only; no discovery feed, search, or follow graph |
| [18](18-community.md) | Community | A/B/C | 8 | 5 | Polls/Surveys don't collect votes; 2 items ComingSoon |
| [19](19-program.md) | Program | A/B | 5 | 5 | CFP has no review workflow; CEU generates no certificate |
| [20](20-speakers.md) | Speakers | B | 3 | 3 | Portal is a record, not a portal — speakers cannot log in |
| [21](21-sponsors-expo.md) | Sponsors & Expo | A/B | 5 | 5 | No deliverable tracking, no sponsor ROI |
| [22](22-broadcast.md) | Broadcast & On-demand | B | 7 | 7 | No video stack — rooms are pasted third-party links |
| [23](23-settings.md) | Settings | A/C | 8 | 6 | No webhooks, no usage metering, no audit log |

**Totals:** 168 unique nav titles · 142 registry keys · **28 leaf items fall
through to `ComingSoonScreen`** (plus 14 parent section titles, which is
expected) · 10 Registrations sub-items resolve to a folded banner.

---

## Recommended build order

The order matters more than the list. Items 1–3 unblock the majority of every
other section's P0.

1. **[00] Job runner** — one cron endpoint + a `jobs` table. Unblocks reminders,
   drip, scheduled reports, waitlist promotion, installments, early-bird flips,
   dynamic pricing, membership renewal. Nothing else unblocks this many features.
2. **[08] Fees + tax at checkout** — you cannot run a real ticketing business
   without them; organizers price *around* fees.
3. **[09] Real refunds + [08] payouts** — Stripe refund API and Connect.
   "Refund" that doesn't refund is the most dangerous label in the product.
4. **[08] Enforce the ticket rules already being collected** — cheap, and turns
   six Tier-B screens into Tier A in one migration.
5. **[13] Analytics dashboards** — the data already exists; write the queries.
   Twelve dead screens become twelve live ones.
6. **[00] `DataTable` bulk selection** — one shared-kit change upgrades every
   list screen in the app at once.
7. **[16] Workflow executor** — even a synchronous one covering five triggers.
8. **[12] Offline check-in** — the one gap that visibly fails on event day.
9. **Collapse or build the 28 ComingSoon leaves.** A sidebar promising 168 things
   and delivering ~60 reads as vapor; a sidebar promising 60 that all work reads
   as a serious product.
