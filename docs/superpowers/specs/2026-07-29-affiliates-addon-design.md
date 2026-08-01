# Affiliates Addon — Design

**Date:** 2026-07-29
**Status:** Built — schema, attribution pipeline and all six workspace screens.
The portal "Affiliate" section and automatic tier movement are outstanding.
**Depends on:** `2026-07-29-addon-platform-design.md`

An affiliate program for ticket sales, delivered as the first real addon on the
platform. Every decision below was chosen explicitly; nothing here is a default I
picked.

## Decisions

| Question | Decision |
|---|---|
| Identity vs. program | **Shared identity + reusable program template.** One affiliate person per project (one login, one profile, one payout detail, one lifetime-earnings view). Each **event** has its own fully independent program — own tier ladder, rates, rules, budget, window, enrolment. A program can be created from a saved template so you don't rebuild it per event; once created, programs never sync. |
| Affiliate access | **Reuse the members portal.** An affiliate is a `portal_members` row with an affiliate profile attached, and gets an "Affiliate" section in the existing portal shell. No second auth stack. |
| Attribution | **Link + code, last-touch, cookie window** (default 30 days, per-program). A code entered at checkout overrides the cookie. |
| Tier model | **Manual tiers/plans + automatic performance tiers + per-event overrides.** A tier is a named commission plan; a program's ladder can auto-promote/demote on rolling sales, and any affiliate can be pinned to a tier within one program. |
| Commission shapes | Percent of ticket revenue, flat per ticket, flat per order, and per-ticket-type rates layered on top. |
| Commission base | **Post-discount, tickets only.** Excludes add-ons, booking fees and tax. You never pay commission on money you discounted away. |
| Promotion assets | Tracked link per event (`?ref=<slug>`) **and** a code that also discounts the buyer. No standalone vanity codes, no QR kit. |
| Recruitment | **Organiser invites by email only.** No public application form, no self-signup. |
| Rails | Budget + per-affiliate commission caps; self-referral and abuse blocking; order eligibility rules; program window and pausing. |
| Clearance | **Manual approval only.** Nothing auto-approves; the organiser approves commission rows in the ledger. |

## Data model (`events.affiliate_*`)

| Table | Purpose |
|---|---|
| `affiliates` | Project-scoped person: `portal_member_id`, name, email, slug, status, payout details, lifetime totals. |
| `affiliate_program_templates` | Reusable ladder + rate + rule bundle a program is created from. |
| `affiliate_programs` | One per event. Window, status, commission base config, budget, caps, attribution window, eligibility rules. |
| `affiliate_tiers` | The ladder rows for one program: name, threshold, rate model, rate value. |
| `affiliate_enrolments` | (program, affiliate): their tier, rate override, tracked slug, linked discount code, status, per-affiliate cap. |
| `affiliate_clicks` | Click log for attribution + fraud signal: enrolment, ts, IP hash, UA hash, landing URL. |
| `affiliate_commissions` | The ledger: order, enrolment, base amount, rate applied, amount, state (`pending`/`approved`/`reversed`/`paid`), approver, timestamps. |
| `affiliate_payouts` | A payout batch: affiliate, period, total, method, reference, state. Record-only, Stripe-ready hook. |
| `affiliate_tier_changes` | Audit of automatic and manual tier movement. |

`buy_ticket` is **not** modified. Attribution is a separate
`events.attribute_affiliate_order(p_order_id, p_ref, p_code)` SECURITY DEFINER
RPC called after the order lands, so the purchase path keeps its existing
capacity/oversell guarantees and an attribution failure can never lose a sale.

Public code lookup mirrors the existing `public_event_discount` pattern: a
SECURITY DEFINER RPC resolves a ref slug or code for an event without exposing
the affiliate tables to anon.

## Surfaces

**Workspace** (addon nav section "Affiliates"): Affiliates roster · Programs ·
Commissions ledger · Payouts · Program templates · Settings.

**Portal** (new "Affiliate" section in the existing shell): dashboard (clicks,
conversions, earnings, time-range filter) · my programs + links · tier progress ·
earnings and payouts history.

**Public**: `?ref=<slug>` capture on `/e/<id>` — sets the attribution cookie and
logs a click, then strips the param.

## Build order

1. Migrations + data layer.
2. Attribution pipeline (`?ref` capture → cookie → RPC on order) — the part that
   silently loses money if it lands late.
3. Workspace screens.
4. Portal section.
5. Tier automation and clearance tooling.

## Open items deliberately deferred

Stripe Connect payouts, sub-affiliate/MLM levels, public application forms,
standalone vanity codes and the QR share kit were all considered and excluded.
