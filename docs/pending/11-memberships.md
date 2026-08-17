# 11 — Memberships

| | |
|---|---|
| **Nav items** | 3 — Membership Plans, Members, Membership Settings |
| **Registered** | 3/3 |
| **Tier** | **B — sells once, never renews** |
| **Blocked by** | [00 H1 jobs](00-cross-cutting.md), [00 H2 send stack](00-cross-cutting.md), [00 H4 money](00-cross-cutting.md) |
| **Key files** | `memberships/membership_plans.jsx`, `members.jsx`, `membership_settings.jsx`, `entitlement_editor.jsx` (466), `lib/supabase/memberships.js`, `app/api/portal/membership/*` |

---

## 1. What this means in industry

A membership/subscription product (Patreon, Memberful, association platforms
like YourMembership) is defined by the **billing lifecycle**, not the plan list:

- **Recurring billing** — monthly/annual, with proration on upgrade/downgrade,
  trials, and coupons.
- **Dunning** — a failed renewal triggers a retry schedule, mail, a grace period,
  and finally suspension. This is where subscription revenue is actually won or lost.
- **Lifecycle self-service** — the member can upgrade, downgrade, pause, cancel
  (with a save flow), and update their card.
- **Entitlements** — the plan unlocks pricing, early access, content, rooms;
  entitlement changes take effect immediately on state change.
- **Renewal & churn reporting** — MRR, renewal rate, churn, cohort retention.

## 2. What exists today (verified)

- Plans as reusable records (`ticketing_records`, module `membership`), attached to events
- A real **entitlement editor** (466 lines) — plans attach VOD/rooms/perks through one
  shared entitlement model, which is a genuinely good abstraction
- A Members enrollment roster and project-level settings (`ticketing_settings`, module `membership`)
- **Portal purchase works** — `app/api/portal/membership/checkout` + `verify`

Gaps — all in the lifecycle:
- **It is a one-time Stripe payment, not a subscription.** No `mode: "subscription"`,
  no price/product objects, no `customer` retained for future charges
- **No renewal.** A membership sold today never bills again
- **No dunning, no grace period, no suspension**
- **No cancel / pause / upgrade / downgrade** — neither for the member nor the organizer
- No MRR/churn reporting anywhere
- Entitlements are evaluated but nothing revokes them when a membership lapses, because
  nothing can lapse

## 3. Pending deliverables

### P0 — Make it a subscription
- [ ] Switch the portal checkout to Stripe **subscriptions** (`mode: "subscription"`) with Products/Prices mirroring each plan; retain the `customer`
- [ ] Handle `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated|deleted` in the existing webhook
- [ ] Membership state machine: `trialing → active → past_due → grace → suspended → cancelled`, with entitlement resolution reading that state
- [ ] **Revoke entitlements on lapse** — today a lapsed member would keep everything, because there is no lapse

### P1
- [ ] Dunning: retry schedule + mail per attempt + grace window (job runner + send stack)
- [ ] Member self-service in the portal: update card, cancel (with reason capture), pause, change plan with proration
- [ ] Organizer actions on the Members screen: comp a membership, extend, cancel, refund

### P2
- [ ] MRR / renewal rate / churn / cohort retention (feeds [13 Analytics](13-analytics.md))
- [ ] Plan upgrade prompts at the point of ticket purchase ("members pay $40 — join for $10/mo")

## 4. UX & component placement

### Membership Plans
| Issue | Change |
|---|---|
| Plans render as a generic record table | Plans are a **pricing page** — use a card/gallery presentation showing price, interval, and the entitlement list per plan, ordered by price. This is how members and organizers both think about them |
| Entitlements are edited in a separate editor with no summary on the plan row | Show entitlement chips (`VOD · 2 rooms · 15% off tickets`) on the card. A plan whose benefits are invisible is unsellable |
| No member counts | Add `142 members · $1,420 MRR` per plan once billing is real — the two numbers that decide whether a plan stays |

### Members
| Issue | Change |
|---|---|
| A flat roster | Add state as the primary filter chip row (`Active · Past due · Cancelled · Trialing`) — the roster's job is to surface the members needing attention, and `past_due` is the only urgent state |
| No renewal visibility | Columns: plan, state, **renews on**, lifetime value. Sort by renewal date |
| No lifecycle actions | Row actions: Comp, Extend, Change plan, Cancel — each writing to the audit log ([00 H7](00-cross-cutting.md)) |
| Members here are disconnected from [07 Contact Book](07-guests.md) | Link both ways; a member is a contact with a subscription, and support staff will start from whichever screen they're on |

### Membership Settings
| Issue | Change |
|---|---|
| A settings singleton with no readback | Add a **preview of the join flow** as the member sees it (the portal already renders it) beside the settings, so the organizer can see the consequence of each toggle |
| Enablement is buried | Put the master enable at the very top as a prominent `SettingRow`, and **disable the rest of the form when off** rather than letting people configure a dormant module |

## 5. Schema / API work
- [ ] `events.memberships` gains `stripe_subscription_id`, `stripe_customer_id`, `state`, `current_period_end`, `cancel_at_period_end`
- [ ] `events.membership_invoices` for the billing history the portal and Members screen both need
- [ ] Entitlement resolution takes membership `state` as an input (currently existence is enough)
- [ ] Job kinds: `membership.dunning_retry`, `membership.expire_grace`
