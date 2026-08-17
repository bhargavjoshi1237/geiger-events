# 06 — Registrations

| | |
|---|---|
| **Nav items** | 6 real + **10 folded** (Plus-ones, Token-gated, Member-only, Conditional Questions, Group Registration, Registration Deadlines, Autofill Returning, Register on Behalf, Waitlist Auto-promotion, Confirmation Page) |
| **Registered** | 6 real screens + 10 `folded_redirect.jsx` banners |
| **Tier** | **A** for RSVPs / Forms / Approval Gates · **B** for Waitlist auto-promotion |
| **Blocked by** | [00 H1 job runner](00-cross-cutting.md), [00 H2 send stack](00-cross-cutting.md) |
| **Key files** | `registrations/registration_forms.jsx` (896), `dietary_accessibility.jsx` (1044), `approval_gates.jsx` (558), `waitlist.jsx` (540), `registrations.jsx` (521), `folded_redirect.jsx` |

---

## 1. What this means in industry

Registration (Cvent, Swoogo, RegFox) is a **flow engine**, not a form:

- **Multiple registration paths** per event (attendee / speaker / exhibitor / staff),
  each with its own questions, price and approval rules.
- **Conditional logic** — show/hide/require questions based on prior answers, and
  branch the whole path.
- **Group / team registration** — one registrant buys N seats and either fills in
  details now or invites people to complete their own.
- **Approval routing** — a queue with approvers, reasons, and templated
  approve/decline mail.
- **Waitlist with automatic promotion** — capacity frees, the next person is
  offered a time-boxed claim window, and their offer expires to the next in line.
- **Abandonment recovery** — someone who started but didn't finish gets a nudge.
- **Confirmation & deadlines** — a configurable confirmation page, calendar file,
  and hard/soft registration cut-offs.

## 2. What exists today (verified)

Genuinely good:
- A real **form builder** (896 lines) with fields, and an Access tab
- **Approval Gates** with a working approve → email path (`app/api/registrations/approval-email/route.js`
  is one of only **3 live email types** in the whole catalog)
- **Waitlist** screen, **Capacity Limits**, and a substantial **Dietary & Accessibility** module (1044 lines)
- RSVP roster with a registration drawer and organizer-added registrants

The folded ten are handled honestly — `folded_redirect.jsx` shows a banner
explaining where the feature actually lives rather than faking a screen. That is
the right call architecturally. But note what it means for the sidebar: **16
entries, 6 destinations.**

Gaps:
- **Waitlist auto-promotion cannot work** — there is no job runner to detect freed
  capacity, no offer window, no expiry. The banner says it's a behaviour; today it is neither
  a screen nor a behaviour.
- Conditional questions: the banner promises a "show when" rule in the form builder —
  verify it exists end-to-end on the public page renderer, and that the rule is
  re-evaluated server-side on submit (a client-only rule is not a rule).
- No multi-path registration; one event has one flow.
- No abandonment recovery.

## 3. Pending deliverables

### P0
- [ ] **Waitlist auto-promotion** on the job runner: on capacity release (refund, cancellation, tier increase) → offer to the head of the queue with a `claim_expires_at`, send the mail, expire and roll forward on timeout
- [ ] Verify/implement server-side evaluation of conditional-question rules on submit
- [ ] Wire the registration email types that are declared but not live: confirmation, reminder, waitlist offer, declined, cancelled ([00 H2](00-cross-cutting.md))

### P1
- [ ] Registration paths: N flows per event, each with its own form, price, capacity and approval rule
- [ ] Group registration completion — invite links per seat, partial-completion tracking
- [ ] Abandoned-registration recovery (a job + a template)
- [ ] Deadlines as enforced rules (close at datetime, per path), not just copy

### P2
- [ ] Approval routing with multiple approvers and delegation
- [ ] Registration transfer/substitution (distinct from ticket transfer in [08](08-tickets.md))

## 4. UX & component placement

### RSVPs (`registrations.jsx`)
| Issue | Change |
|---|---|
| **No `StatsBar`** — this screen goes `ScreenHeader → Toolbar → DataTable`, unlike every sibling | Add one: Registered / Pending approval / Waitlisted / Checked in. Registration is a funnel; showing only the final list hides the funnel |
| Filters and search are in the toolbar but the event scope is not obvious | Put the **event selector as the first control in the `Toolbar`**, styled distinctly (it changes the meaning of everything else on screen). Persist it in the URL |
| No bulk actions on a roster — the single most bulk-oriented list in the product | [00 H5](00-cross-cutting.md): select → Approve, Decline, Resend confirmation, Add tag, Export |
| The drawer opens per registrant with no next/prev | Add ↑/↓ navigation in the drawer header — approving 40 registrants one at a time otherwise means 40 open/close cycles |

### Registration Forms
| Issue | Change |
|---|---|
| Form builder without a live preview means the author guesses | **Split the editor: builder left, live preview right** (the pattern `page_design.jsx` already uses). Reuse that component rather than inventing a second preview |
| Conditional rules are configured per field with no overview | Add a "Logic" view listing every rule in the form — rules become unmaintainable the moment there are more than five and they're only visible one field at a time |
| Publish state of a form is unclear | Status pill in the editor header + which events use this form (with a count that links out) |

### Waitlist
| Issue | Change |
|---|---|
| A flat list gives no sense of queue | Show **position** as the first column and make the ordering explicit; add "offer expires in" as a countdown chip once P0 lands |
| No manual override | Add row actions: Promote now, Skip, Remove — organizers always need to override the queue |

### The ten folded items
- Keep the banner pattern — it's honest — but **make the banner actionable**: each should carry a button that takes the user to the exact control (e.g. "Open form Access tab"), not just describe where it is.
- Consider collapsing these ten out of the sidebar entirely once the [23 Settings → Navigation](23-settings.md) curation is the default way users trim nav. Ten entries that are really documentation inflate the perceived-vs-real feature gap more than they help discovery.

## 5. Schema / API work
- [ ] `events.waitlist_offers` (registration_id, offered_at, expires_at, status)
- [ ] `events.registration_paths` (event_id, name, form_id, price, capacity, approval_required)
- [ ] Job kinds: `waitlist.promote`, `registration.abandoned_nudge`, `registration.reminder`
