# 14 — Campaigns

| | |
|---|---|
| **Nav items** | 8 — Newsletters, Automated Reminders, Email Invites, Segmentation, Email Template Builder, Drip Sequences, Send Scheduling, Deliverability |
| **Registered** | 8/8 (plus SMS/WhatsApp/Text/Push/A-B lenses registered but not in the sidebar) |
| **Tier** | **B — authoring works, sending does not exist** |
| **Blocked by** | [00 H1 jobs](00-cross-cutting.md), [00 H2 send stack](00-cross-cutting.md) |
| **Key files** | `campaigns/campaigns.jsx` (597), `campaign_editor.jsx` (483), `lenses.jsx` (29), `email_template_builder.jsx`, `drip_sequences.jsx`, `deliverability.jsx`, `segmentation.jsx`, `lib/email/catalog.js` |

---

## 1. What this means in industry

Email/lifecycle marketing (Mailchimp, Klaviyo, Braze) is 20% authoring and 80%
delivery infrastructure:

- **Deliverability** — a verified sending domain with SPF, DKIM and DMARC; IP/domain
  warm-up; bounce and complaint handling into a suppression list; list hygiene.
  Without this, mail lands in spam and the rest is irrelevant.
- **Sending** — throttled, queued, resumable, with per-recipient personalisation
  and a send log.
- **Automation** — drip sequences with waits, branches and goals; behavioural
  triggers ("registered but didn't pay", "attended last year, hasn't this year").
- **Testing** — A/B on subject/content with a statistically-valid winner and
  auto-promotion.
- **Measurement** — delivered, open, click, bounce, complaint, unsubscribe,
  revenue attributed per campaign.
- **Compliance** — consent per channel, one-click unsubscribe, preference centre.

## 2. What exists today (verified)

Authoring side, real:
- A channel-aware campaign hub (597 lines) + editor, with lenses filtering it per channel
- Email Template Builder and Drip Sequences as record sets
- Segmentation folds onto the shared [07 Segments](07-guests.md) screen, which is backed by
  a genuine audience resolver (`lib/audience/resolve.js`)

Delivery side, absent:
- **No email, SMS or push provider in `package.json`** — no Resend, SendGrid, Postmark,
  SES, Twilio
- `lib/email/catalog.js` declares **61 transactional email types; 3 are marked `live`**.
  The file is explicit: the rest "are declared so the catalog is the complete plan of
  record — their toggle is stored and honored the moment a send site is wired"
- Delivery is delegated to geiger-dash, which owns "rendering + Resend delivery + the send log"
- **No job runner**, so Automated Reminders, Drip Sequences and Send Scheduling cannot
  fire even if a provider existed
- **Deliverability is a settings page with no domain authentication** — nothing verifies
  SPF/DKIM/DMARC, and there is no bounce/complaint pipeline
- **SMS, WhatsApp and Push are selectable channels with no implementation whatsoever**

The result: a user can compose a newsletter, pick an audience, schedule it, and
**nothing will ever be sent**, with no error to tell them so. That is the most
directly harmful Tier-B behaviour in the app.

## 3. Pending deliverables

### P0 — Stop the silent failure (do this first, it's an afternoon)
- [ ] Decide and document the ownership boundary with geiger-dash at the top of `lib/email/catalog.js`
- [ ] Until sending works, **the Send button must not claim success**. Either disable it with a plain explanation ("Sending isn't connected yet") or route it through a real provider. A green "Campaign scheduled" toast for a send that cannot happen is worse than a missing feature

### P0 — Make one channel real end to end
- [ ] Email only. Wire compose → audience resolve → queue → provider → send log → status on the campaign
- [ ] `events.email_sends` (campaign_id, contact_id, status, provider_id, opened_at, clicked_at, bounced_at) — this table is also what [13 Email Performance](13-analytics.md) needs
- [ ] Consent + suppression check before every send ([07 P0](07-guests.md))
- [ ] One-click unsubscribe header and a working unsubscribe link (legally required)

### P1
- [ ] Domain authentication flow in Deliverability: add domain → show DNS records → verify → status. Reuse the CNAME verification UX already built for [23 Custom Domains](23-settings.md) (852 lines) — the pattern exists
- [ ] Bounce/complaint webhook → suppression list
- [ ] Automated Reminders + Send Scheduling on the job runner
- [ ] Drip Sequences execution (this is the same engine as [16 Workflows](16-workflows.md) — **build one engine, not two**)

### P2
- [ ] A/B testing with a real winner rule
- [ ] SMS/WhatsApp/Push adapters — **or remove those channels from the UI**
- [ ] Revenue attribution per campaign (needs UTM capture from [13 P1](13-analytics.md))

## 4. UX & component placement

### Campaigns hub
| Issue | Change |
|---|---|
| Campaign state is the whole story and the table treats it as one pill among columns | Lead with a **status chip row as filters** (`Draft · Scheduled · Sending · Sent · Failed`) above the table, with counts. Marketing tools are status-first; that's how people navigate them |
| Sent campaigns and drafts share one list with no performance data | For `Sent`, replace the generic columns with **recipients / delivered / open / click** once the send log exists. A sent campaign with no metrics is a dead row |
| Channel is a filter | Channel should be a visible **icon on every row** — mixed-channel lists are unreadable otherwise |

### Campaign editor
| Issue | Change |
|---|---|
| Compose, audience and schedule are peers in a form | Restructure as an explicit **three-step flow with a persistent summary rail on the right**: *To (audience + live count) · Content (subject, preview text, body) · When (now/scheduled)*. Every mature email tool converges on this because the sender must see all three before committing |
| No audience count at compose time | Show the resolved recipient count live in the rail — `lib/audience/resolve.js` can already compute it. Sending blind to a count is how accidents happen |
| No preview | Split content editing with a **device-toggled preview** (desktop/mobile) + a "send test to me" button. Reuse the preview pattern from `page_design.jsx` |
| Send has no confirmation weight | A pre-send confirmation dialog listing audience size, subject, sending domain and schedule. This action is irreversible and public — it deserves more friction than a `Save` |

### Email Template Builder
- Templates are visual: **gallery presentation** with thumbnails, not a table
- Editor: blocks left, canvas centre, properties right — the same three-zone contract as [04](04-event-design.md) and badge design

### Drip Sequences
- A sequence is a flow; render it as a **vertical timeline** (step → wait → step) with per-step stats, not a record form. Once [16](16-workflows.md) has a canvas engine, reuse it here rather than maintaining two authoring models

### Deliverability
| Issue | Change |
|---|---|
| Settings with no state | Turn it into a **health page**: domain verification status (SPF/DKIM/DMARC each with a pass/fail chip), reputation, bounce rate, complaint rate, suppression count — with the DNS records copyable |
| No sense of consequence | Put a plain-language health verdict at the top ("Your domain isn't verified — mail will land in spam") rather than a form of toggles |

## 5. Schema / API work
- [ ] `events.email_sends`, `events.suppressions`, `events.sending_domains`
- [ ] Job kinds: `campaign.send_batch`, `campaign.scheduled_send`, `drip.advance`
- [ ] Provider webhook route for delivery/bounce/complaint events
