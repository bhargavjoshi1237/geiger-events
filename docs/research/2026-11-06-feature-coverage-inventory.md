# Geiger Events: feature coverage inventory

6 Nov 2026. Every dashboard screen, event-editor section and public route was checked in code to see whether it really works, then matched against what geiger.studio publishes about it. Follows the [Google AI exposure analysis](2026-11-05-google-ai-exposure-analysis.md).

## Headline

| Measure | Result |
| --- | --- |
| Inventory rows (screens, editor sections, public routes) | 178 |
| Work end to end | 68 |
| Partly work (core works, named parts missing) | 57 |
| Records only (saved, nothing reads them) | 39 rows, about 58 screens |
| Demo data | 4 rows, about 15 screens |
| Placeholder / Coming soon | 10 rows, about 22 screens |
| Events blog posts Google showed during the 4 Nov audit | **5 of 8** |
| Events feature and solution pages Google showed for their own title | **0 of 54** (discount codes surfaced once) |
| Working features with no public page, post or help section at all | MCP server, desktop app, Web Clip |

**What this means for content.** On this domain Google indexes blog posts and skips the 54 templated feature and solution pages, which were added in late July. So new content should be blog posts that answer one buyer question each and link to the matching feature page. Write only about the 68 features that work, plus partial features described by what actually happens. (Rows that group identical screens, such as the 12 analytics dashboards, count once in the table above.)

**Before writing anything,** fix the security issues and the bugs in the next section. Several of them would make the content false or harmful.

## Fix before publishing

### Security

| # | Issue | Where | Effect |
| --- | --- | --- | --- |
| S1 | Checkout charges the ticket price the browser sends | `app/api/checkout/route.js:145,219-227`; unknown purchasables fall back to the client price (`:30`); `buy_ticket` also accepts a caller price | Anyone can buy any ticket for 50 cents by editing the request. Payments go live to organisers' own Stripe accounts |
| S2 | Approval can be skipped; anyone can trigger an "approved" email | `?approved=1&email=` is unsigned and never checked on the server; `app/api/registrations/approval-email` needs no login | Invite-only events aren't invite-only |
| S3 | Anonymous read/write on inventory (including the redemption ledger) and NFC tables (including reader device keys) | inventory and `20260908000000_nfc_paid_entry.sql` RLS | The code-gated desks can be bypassed |
| S4 | Affiliate attribute and reverse functions callable by anyone | `20260729104841_affiliates.sql:717,748` | Commission ledger can be edited from outside |
| S5 | Group discount applies whenever an attendee list is sent, even with group purchasing off | `route.js:277`, `lib/events/group.js:46` | Free discount by editing the request |
| S6 | Kiosk "Buy a ticket" records a paid order without taking payment | `app/kiosk/[eventId]/page.js` | Free paid tickets from any unattended kiosk |

### Bugs that make a claim false

| # | Bug | Blocks content about |
| --- | --- | --- |
| B1 | The door scanner can't read the product's own QR codes. Tickets, the portal, the app and badges encode the full order ID; `checkin_search` only matches name, email or the first 8 characters of a registration ID (`20260715100707_checkin_routes.sql:99-102`). `issue_lookup` already matches full IDs and can be copied **Fixed 2026-11-07, not live until pushed** (see `20261107120000_checkin_orders.sql`, geiger-dash middleware) | Check-in, QR tickets, badges, kiosk |
| B2 | `/events/checkin`, `/door`, `/kiosk` and `/issue` are missing from geiger-dash's `PUBLIC_PREFIXES` (`utils/supabase/middleware.js`), so staff devices hit the organiser login on geiger.studio **Fixed 2026-11-07, not live until pushed** (see `20261107120000_checkin_orders.sql`, geiger-dash middleware) | Every staff-device feature, merch pickup |
| B3 | Refunded and cancelled QR codes still admit **Fixed 2026-11-07, not live until pushed** (see `20261107120000_checkin_orders.sql`, geiger-dash middleware) | Refunds, check-in |
| B4 | Session check-in rejects anyone already checked in at the door or another session **Fixed 2026-11-07, not live until pushed** (see `20261107120000_checkin_orders.sql`, geiger-dash middleware) | Session check-in, CEU |
| B5 | Ticket-only discount codes record an undiscounted order total and never count usage (the 20260904 `buy_ticket` overwrote the rules version) | Discount codes |
| B6 | Free RSVPs and $0 tickets get no email, but the success screen says a confirmation was sent | Free events, RSVP |
| B7 | Draft events are public and buyable by link; an event with no tiers sells a made-up "General Admission" ticket of about $25 | Event publishing |
| B8 | VIP package stock and add-on stock caps aren't enforced at checkout | Packages, merch add-ons |
| B9 | Event chat stops enrolling buyers who buy after the channel opens | Event chat |
| B10 | Seat holds can expire during a slow Stripe payment, leaving the buyer charged with no order | Assigned seating |
| B11 | Custom answers are dropped when Stripe metadata passes 480 characters | Registration questions |
| B12 | Live rooms, webinars, breakouts and recordings show only to members, never to plain ticket buyers | Livestream, hybrid, on-demand |
| B13 | Campaign "Send now" marks a campaign sent and records deliveries without sending anything | (Misleading UI, not advertised) |

### SEO gap in the product itself

Organiser event pages (`/e/<id>`) have no `generateMetadata`, no Open Graph tags and no Event JSON-LD, and the event editor's SEO fields are never output. Every public event page is a chance for an Event rich result and a "Powered by Geiger Events" link back to geiger.studio. Adding them would give Google many more real pages pointing at the domain than the 54 marketing pages do.

## The content queue

These features work, nobody else in the buyer answers covers them well, or Google has nothing correct about them. Ranked by buyer demand and how unusual the feature is. "Blocked by" items must be fixed first.

| # | Feature | Status | Proposed post (one buyer question) | Existing coverage | Blocked by |
| --- | --- | --- | --- | --- | --- |
| 1 | No platform fee, payouts to the organiser's own Stripe | Works (untested live) | What does Geiger Events charge per ticket? A $25-ticket comparison | Pricing FAQ (staged) | S1, Connect test payment |
| 2 | Badge designer and printing | Works | How do I design and print conference name badges from my attendee list? | Page: badge-printing (invisible). Help: check-in › Pass designs, Printing and exporting passes | — (the badge QR is hit by B1, so don't promise scanning) |
| 3 | Display boards | Works | How do I put the live agenda on venue screens without a signage subscription? | Help: program › display boards. Draft page staged | — |
| 4 | Brand import | Works | How do I make my event page match my website? | Help: event-page › Importing a brand | — |
| 5 | Ticket waves (batched releases) | Works | How do I release tickets in waves that unlock when the last one sells out? | Help: ticket-rules › Splitting a ticket into waves. The dynamic-pricing page claims something else | — |
| 6 | Assigned seating with timed holds | Works | How do I sell reserved seats for a 300-seat theatre? | Page: reserved-seating. Help: venues, tickets. Blog: fair-ticketing | B10, S1 |
| 7 | Exhibitor booth sales on a floor plan | Works | How do I sell exhibitor booths online from a floor plan? | Help: sponsors › Selling exhibitor booths. Solution: expo-trade-show-management | S1 |
| 8 | Sponsorship prospectus page | Works | How do I make a sponsorship prospectus page that collects enquiries? | Help: sponsors. Draft page staged | — |
| 9 | MCP server (manage events from Claude or ChatGPT) | Works | Can I manage my events from Claude or ChatGPT? | **None** | — |
| 10 | Dietary and accessibility requests | Works | How do I collect dietary and accessibility needs before an event? | Help: registrations › Dietary and accessibility | — |
| 11 | Group orders, one ticket per attendee | Partial | How do I sell group tickets where everyone gets their own ticket? | Help: ticket-rules › Group orders | S5 |
| 12 | Merch and badge pickup without double collection | Works | How do I stop attendees collecting merch twice? | Help: inventory. Draft page staged | B2, S3 |
| 13 | Event pages with automatic directions, parking and weather | Works | What should an event page include about getting there? | Help: event-page › Map and directions | — |
| 14 | Event chat with live polls, plus Q&A | Works | How do I run attendee chat and live polls without a separate app? | Page: event-community-engagement. Help: community | B9 |
| 15 | Operations workspace for presenters, judges and volunteers | Works | How do I organise judges, presenters and volunteers for a competition? | Help: operations | Notice emails need a scheduler |
| 16 | Members portal | Works | Where do attendees find their tickets, receipts and event chat? | Help: members-portal | — |
| 17 | Express Lane two-click checkout | Works | How do I make event checkout two clicks? | Help: tickets › Express Lane | S1 |
| 18 | Purchase disclaimer recorded in Stripe | Works | How do I make buyers accept terms before paying? | Help: tickets › Purchase disclaimer | — |
| 19 | Approval before payment | Partial | How do I approve attendees before they pay? | Help: registrations › Approving. Draft page staged | S2 |
| 20 | Public replay pages | Works | How do I share a session recording publicly? | Help: broadcast › Sharing a public replay page | — |
| 21 | Inventory with purchase orders | Works | How do I track event merch stock and reorders? | Help: inventory | S3 |
| 22 | Capacity with an overbook buffer | Works | How do I oversell a free event safely to cover no-shows? | Help: registrations › Capacity and the overbook buffer | — |
| 23 | VIP packages page | Partial | How do I sell VIP and hospitality packages? | Help: packages. Draft page staged | B8 |
| 24 | Affiliate and promoter tracking | Partial | How do I track ticket sales by promoter? | Help: settings › Add-ons. Draft page staged | S4; attribution runs only in the buyer's browser |

**Hold until fixed:** check-in app, QR tickets, kiosk, door sales (B1, B2, S6), RFID/NFC (S3), refunds (record only, B3), livestream and hybrid (B12), discount codes (B5).

**Never write about until built:** wallet passes, offline check-in, email and SMS campaigns, reminders, automations, analytics, API and webhooks, lead retrieval, custom domains, certificates, call for papers submissions, personal agendas, dynamic pricing, multi-currency, payment plans, transfers, taxes, anti-scalping rules, member discounts, translation, embeddable widget, mobile app, captions.

## Published pages that describe what doesn't exist

The 5 Nov audit already planned to unpublish 8 pages: wallet-passes, lead-retrieval, anti-scalping-resale, dynamic-ticket-pricing, event-email-sms-marketing, event-analytics, event-automation, api-webhooks.

This inventory adds the following. Pages with 0 staged corrections are not fixed by `go-live.mjs`.

| Page | Problem | Staged corrections | Action |
| --- | --- | --- | --- |
| custom-domains-branding | Custom domains are simulated: no DNS check, no storage, no routing | 0 | Rewrite as brand import and page design |
| certificates-ceu | Nothing is issued to attendees | 12 | Unpublish |
| call-for-papers | No public submission form, no speaker portal | 11 | Unpublish or rewrite as "review proposals" |
| event-templates | You can't save an event as a template; only basic fields carry over | 0 | Rewrite |
| event-series-recurring | The repeat rule creates no events; no public series page | 0 | Rewrite |
| event-floor-plans-seating | Object library, to-scale plans, setup styles and room templates don't exist | 0 | Rewrite as seat maps and exhibitor halls |
| venue-sourcing | Sells Smart Custom Proposals and Instant Book, both Coming Soon | 0 | Rewrite to the OpenStreetMap search and pipeline |
| conference-agenda-speakers | No personal agenda for attendees; agenda builder sessions don't reach the public page | 10 | Rewrite |
| livestream-webinar-rooms | Members only; captions are faked | 6 | Rewrite |
| event-check-in-app, rfid-nfc-access | Depend on B1, B2, S3 | 14, 2 | Hold until fixed |
| dynamic-ticket-pricing | Prices never move | — | Rewrite into a ticket-waves page instead of unpublishing |

**Blog posts to recheck.** Their headings lean on features that are records only: per-ticket-registration-questions (organisers can't view per-ticket answers), conditional-registration-form-examples (Events checkout has no conditions), fair-ticketing-reserved-seating-anti-scalping (anti-scalping rules aren't enforced), conference-management-software-guide (call for papers and certificates), recurring-events-memberships-guide (recurrence and automations). Only the headings were checked, not the body text.

## Full inventory

Coverage key: **P** feature or solution page, **H** help article › section, **B** blog post. "—" means none.

### Events, pages and design

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| All Events | Works | Lists, creates, opens and deletes events; Duplicate copies only basic fields | H: events › The All Events list |
| Templates | Partial | Creates a draft from a template (format, capacity, visibility, timezone, summary). You can't save an event as a template | P: event-templates (overclaims). H: events › Event templates |
| Event Series | Partial | Groups events, shows combined stats and pushes shared defaults. The repeat rule only previews dates | P: event-series-recurring (overclaims). H: events › series. B: recurring-events-memberships-guide |
| Recurring events (editor) | Records only | Saves a repeat rule and creates nothing | as above |
| Event Wall | Works | Public `/w/<slug>` page of listable events with cards, list, search, calendar, featured, theme and CTA. Saved sort order ignored | P: organizer-event-page. H: event-wall |
| Organiser profile and Follow | Partial | Follow saves the follower's email (CSV export); nobody is ever emailed, no unsubscribe | P: organizer-profiles-followers (corrections staged). H: event-wall › Followers |
| Public event page | Works | Server-rendered `/e/<id>`, refreshed every 10 s. Draft events stay public (B7); only Private is hidden | — |
| Page design (4 modes, 19 layouts) | Works | Standard, Themed, Imported or Custom modes; colours, fonts, background image or video, light/dark default | P: event-page-builder. H: event-page › Page design |
| Page builder | Works | Drag-and-drop tree with live data bindings, project-wide saved layouts and permission-gated custom CSS/JS. Email-capture block discards emails | P: event-page-builder. H: event-page › The page builder |
| Brand import | Works | Pulls logo, colours, fonts, buttons, nav, footer, favicon and hero from any site into the page theme | H: event-page › Importing a brand |
| Web Clip | Works | Clips an element off a live website into the schedule as cleaned HTML and CSS | — |
| Cover media and gallery | Partial | Cover image or video and a grid or carousel gallery. No social share previews | H: event-page › Cover image and gallery |
| Description, highlights, FAQ | Works | Markdown description, highlights card, expandable FAQ | H: event-page |
| Schedule (page) | Works | Running order as list, cards or timeline. Separate from the Agenda Builder | H: event-page › Building the schedule |
| Section notes and renamable titles | Works | "i" notes on sections; headings can be renamed (Guests → Fighters) | H: event-page › Showing, hiding and renaming sections |
| Page disclaimer | Works | Fine print at page top, hero, footer or in checkout | H: event-page › Section notes and the disclaimer |
| Guests block | Works | Speaker or guest cards with photo, role, company, bio | H: event-page › Featuring guests |
| Infographics | Works | Carousels, split CTAs, quotes, footer bands | H: event-page › Infographics |
| Location and time | Works | Venue picker or address search with pin drop | H: events › Location and time |
| Map, directions, nearby places, weather | Works | OpenStreetMap map, automatic transit, parking, hotels and food, Google Maps directions, forecast within ~16 days | H: event-page › Map and directions |
| Dietary and accessibility (page) | Works | Guidelines card plus an optional post-purchase request form | H: registrations › Dietary and accessibility |
| Venues | Works | Reusable venues that fill address, timezone, map and transit; hold seat maps and hall plans | P: venue-management. H: venues |
| Packages (VIP) | Partial | Standalone `/e/<id>/packages` page; buy through checkout or enquire. Stock never reduced (B8) | H: packages. Draft page staged |
| Visibility | Partial | Private really hides the page. Unlisted behaves like Public; password and indexing switches ignored | H: events › Visibility and publishing |
| Overview | Works | Real sold, revenue, sell-through and days-to-go figures | H: events › Event overview |
| Co-hosts and admins | Partial | Adds people to an event team with an in-app notice; grants no access, emails nobody | H: events › Co-hosts and admins |
| Alerts | Records only | Milestone alert rules nobody reads | — |
| Custom URL | Records only | Saves a slug no route serves | — |
| SEO and sharing | Records only | Meta title and description never output | — |
| Add to calendar | Partial | Portal `.ics` download works; success-screen button only shows a message | H: members-portal |
| Embeddable widget | Records only | Snippet points to a file that doesn't exist | — |
| Localization | Records only | Language list, no translation | — |
| Time-zone options | Records only | Saved, never read | — |
| Hybrid mode | Records only | Stream settings never read; format is only a label | — |
| Speakers attached to an event | Records only | `speakerIds` saved, never displayed | — |
| On-demand video (editor) | Records only | Video links nobody shows | — |
| Custom domains | Demo data | "Verify" always succeeds after 2 s; nothing is stored or routed | P: custom-domains-branding (overclaims) |
| Playground | Demo data | Whole dashboard on seeded in-memory data, no sign-in | H: help/events › Trying Events in the playground |
| Desktop app | Works | Windows Electron shell with in-app sign-in and org picker; installer unsigned, no Mac build | — |

### Tickets, checkout and payments

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| Event tickets and rules | Works | The tiers saved per event are exactly what buyers see and buy; per-event rule switches are honoured | P: event-ticketing-payments. H: tickets |
| Ticket Types (library) | Partial | Name, price and quantity sell; sales window, min/max per order and type-level toggles unread | H: tickets › Ticket types |
| Ticket Tiers | Works | Named levels that group tickets under headings; display only | H: tickets › Ticket tiers and groups |
| Stripe Connect, no platform fee | Works | Ticket sales are direct charges on the organiser's own Stripe account; refuses with 409 if not connected. Untested live | H: payments › Taking payments |
| Express Lane | Works | Two-click checkout; Stripe collects name and email; switches off for seating, questions, add-ons and approval | H: tickets › Express Lane |
| Purchase disclaimer | Works | Final review step with an "I agree" tick; agreement time stored in Stripe metadata | H: tickets › Purchase disclaimer |
| Branded Stripe checkout | Works | Stripe page takes the event page's brand colours | — |
| Ticket email status and resend | Works | Success screen checks for 30 s whether the ticket email sent; rate-limited Resend | H: tickets › Payment and ticket emails |
| Free ticket / RSVP path | Partial | Order and registration recorded; no email sent (B6) | H: registrations |
| Offerings (add-ons) | Works | Priced choices charged as separate Stripe lines | H: tickets › Offerings |
| Purchasables (conditional add-ons) | Partial | Add-ons step shown by slot, ticket or quantity rules; "members only" rule never matches | H: tickets › Purchasables |
| Time slots | Works | Buyers pick a slot with its own capacity and price change; server enforces capacity | H: tickets › Time slots |
| Discount codes | Partial | Server-checked rules taken off the Stripe charge; recorded total and usage wrong for ticket-only codes (B5) | P: discount-codes-promo. H: ticket-rules |
| Early-bird | Partial | Time-window discount charged and re-checked in the database; "stack with coupons" setting ignored | H: ticket-rules › Early-bird pricing |
| Donations | Partial | Suggested or custom donation as its own Stripe line; "required" not enforced | H: ticket-rules › Donations at checkout |
| Access-code tickets | Partial | Codes unlock hidden tickets, re-checked in the database; screen settings unread | H: ticket-rules › Hiding tickets behind an access code |
| Group orders | Partial | One payment becomes one order per attendee, each in their own portal; only the buyer gets the email | H: ticket-rules › Group orders |
| Bundles | Partial | Editor bundles sell and draw stock from each item; the Bundles library is never read | H: ticket-rules › Selling bundles |
| Batched releases (waves) | Works | Waves open now, on a date, after the last sells out, or by hand; enforced by the page and the database | H: ticket-rules › Splitting a ticket into waves |
| Capacity and overbook buffer | Works | Capacity plus buffer enforced inside the purchase transaction | H: registrations › Capacity and the overbook buffer |
| Held-back quantity ("Reserved Seating" screen) | Partial | Holds stock back from online sale; not a seat map | H: tickets › Reserved seating and held tickets |
| Assigned seating | Works | Buyers pick exact seats on a venue map; timed holds survive the trip to Stripe; refunds release seats | P: reserved-seating, event-floor-plans-seating. H: venues, tickets › Selling assigned seats. B: fair-ticketing |
| Ticket selection (seat vs price) | Partial | Both routes offered; no automatic best-seat assignment | — |
| Affiliate `?ref` links | Works | Logs the click; credits the order from the buyer's browser on the success screen | H: settings › Add-ons |
| Anti-scalping and resale | Records only | Rules saved, none enforced | P: anti-scalping-resale (unpublish). B: fair-ticketing |
| Dynamic pricing | Records only | Buyers always pay the listed price | P: dynamic-ticket-pricing (rewrite) |
| Multi-currency | Records only | One currency per event (USD, EUR or GBP), no conversion | — |
| Payments and methods (library) | Records only | Records unread; real setup is Settings › Payments | H: payments › Payment methods |
| Payment plans | Records only | Checkout takes one-off payments only | H: payments › Payment plans |
| Payouts (library) | Records only | Real payouts happen in the organiser's Stripe | H: payments › Payout accounts |
| Transfers | Records only | No transfer flow exists | H: payments › Ticket transfers |
| Taxes | Placeholder | Empty screen; no tax is ever charged | — |
| Invoices and receipts (profiles) | Records only | No invoice is generated | H: payments › Invoice and receipt profiles |
| Member pricing on events | Records only | Checkout never applies member prices | — |

### Orders

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| All Orders | Partial | Real cross-event table with Stripe's card, fee and receipt link; resend and refund move nothing | H: orders |
| Refunds and cancellations | Partial | Marks refunded, lowers revenue, frees seats; no Stripe refund, no email, QR still admits (B3) | H: orders › Issuing a refund |
| Refund requests (portal) | Partial | Buyer requests reach the organiser's queue; approving moves no money | H: members-portal › Requesting a refund |
| Transactions | Partial | Real charge ledger; fees are a flat 2.9% + $0.30 estimate | H: orders › The transactions ledger |
| Billing and receipts | Partial | Lists receipts; "Send receipt" and "Generate invoice" send nothing | H: orders › Receipts and invoices |
| Disputes | Records only | Manual tracker; nothing comes from Stripe | H: orders › Logging a dispute |
| Order settings | Records only | Prefix and reason codes ignored | — |

### Registration and guests

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| RSVPs | Partial | Cross-event roster with bulk status changes and CSV; a free sign-up is a $0 ticket, RSVP options unread | P: event-registration-rsvp. H: registrations |
| Custom questions (event) | Partial | Asked at checkout, viewable per registrant; Dropdown has no options, not in CSV | H: registrations › Custom questions |
| Per-ticket questions | Partial | Asked per attendee; organisers can't view or export the answers | H: tickets › Questions for each attendee. B: per-ticket-registration-questions |
| Approval gates | Partial | Request → approve → email link → pay; the link is unsigned (S2), no declined email | H: registrations › Approving and declining |
| Waitlist | Partial | Manual queue with hand promotion; online buyers never join it (kiosk walk-ups do) | H: registrations › Promoting people from the waitlist |
| Dietary and accessibility | Works | Attachable checkout questions, post-purchase requests, needs report and CSV | H: registrations › Dietary and accessibility |
| Register on behalf | Partial | Adds a registrant visible on lists and at check-in; no ticket, QR or email | H: registrations › Adding a registrant by hand |
| Registration forms (library) | Records only | No form can be attached to an event | — |
| Conditional questions | Records only | Rules live on unattachable forms; checkout has no conditions | B: conditional-registration-form-examples |
| Plus-ones, token-gated, member-only, group registration, deadlines, autofill, confirmation page, waitlist auto-promotion | Records only | Saved, never read | — |
| Contact Book | Partial | Manual CRM with CSV import, dedupe, tags, notes and consent flags; buyers aren't added automatically, blocklist unenforced | P: attendee-crm. H: guests |
| Guest List | Works | All-time roster built from registrations, grouped by email, CSV export | H: guests › The Guest List |
| Who's Going | Works | Upcoming-attendee list with CSV; public block shows a count only | H: guests › Who's Going |
| Attendee export | Works | CSV with 17 columns and filters | H: guests › Exporting attendees |
| Segments and tags | Works | Rule-based or hand-picked groups that feed audience targeting | H: guests › Building a segment, Managing tags |
| Notes | Works | Internal contact notes in one feed | H: guests › The Notes feed |
| Audience targeting | Works | Targets by ticket, add-on, offering, tag, segment or person for portal broadcasts and chat | — |
| Data requests | Records only | GDPR/CCPA tracker that changes no data | H: guests › Data requests |

### Check-in

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| QR tickets | Partial | Branded QR on emails and the portal; size, rotating codes and per-event switch unread | H: check-in › Ticket QR codes |
| Check-in app (scanner) | Partial | Code-locked page with name search, camera QR, live counter and gate pickers. Can't read its own QR (B1); blocked on geiger.studio (B2) | P: event-check-in-app (hold). H: check-in |
| Name search lookup | Works | Search by name, email or code and admit with one click | H: check-in › Looking up an attendee |
| Real-time attendance | Works | Checked-in vs expected, by gate and session, every 15 s | H: check-in › Real-time attendance |
| Door sales | Partial | Code-locked POS creating real orders; payment taken outside the app; settings unread | H: check-in › Selling tickets at the door |
| Kiosk mode | Partial | Self check-in and on-the-spot registration; "Buy a ticket" is free (S6) | H: check-in › Running a self-service kiosk |
| Staff scanning roles | Partial | 6-digit codes; scan/sell permissions checked only in the browser | H: check-in › Staff roles and access codes |
| Session check-in | Partial | Staff pick a session and counts show per session; duplicates rejected across sessions (B4) | H: check-in › Session check-in |
| Multi-gate and zones | Partial | Gates and zones recorded and counted; nothing controls access | H: check-in › Gates and zones |
| Badge designer and printing | Works | Per-role and per-tier designs from 8 presets, 16 fields, front and back, print finishes, 5 card stocks, duplex A4/Letter sheets with crop marks, 300-DPI PNG, ZIP and CSV export, 3D lanyard preview | P: badge-printing. H: check-in › Pass designs, Printing and exporting passes |
| RFID / NFC | Partial | Real tap endpoint that admits and logs paid-entry taps; no reader software, bills record-only, open RLS (S3) | P: rfid-nfc-access. H: check-in |
| Self check-in | Records only | Settings unread; the kiosk is the only self-service path | — |
| Lead retrieval | Placeholder | List over a table nothing writes | P: lead-retrieval (unpublish) |
| Offline check-in, capacity control, smart badges | Placeholder | Under development / Coming Soon | P: event-check-in-app claims offline |

### Inventory

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| Items | Works | Catalog with photos, variants and reorder points | H: inventory |
| Stock movements | Works | Append-only ledger kept in step with on-hand by a trigger | H: inventory › The movement ledger |
| Event allocations | Works | Eligibility (ticket, add-on, session, audience, everyone) and collection rules (once, daily, window, rolling) | H: inventory › Issuance and collection rules |
| Issuing desk `/issue` | Works | Scan or search, see what someone may collect, record it; the database refuses a second collection (B2, S3) | H: inventory › Issuing and returning stock |
| Issuing staff | Works | Issue-only codes with Undo and Override enforced on the server | H: inventory |
| Suppliers and purchase orders | Works | Receiving a PO raises stock; POs aren't emailed | H: inventory › Creating a purchase order |
| Stock as an event add-on | Partial | Sells at checkout, collected at `/issue`; stock cap not enforced (B8) | H: inventory › Selling an item as an add-on |

### Program, speakers, sponsors

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| Agenda builder | Partial | Track × time grid with drag-to-reschedule and double-booking flags; feeds display boards, not the public page | P: conference-agenda-speakers (overclaims). H: program |
| Display boards | Works | 1920×1080 slide queue (6 slide types, 4 themes) on a public `/display/<id>` player that follows the real agenda | H: program › Creating a display board. Draft page staged |
| Display board WebM export | Works | Records one pass of the board to a .webm file (Chrome or Edge) | H: program |
| In-venue simulator | Works | Previews a board on 8 simulated 3D venue screens | — |
| Call for papers | Records only | Organiser types in and scores proposals; no public form | P: call-for-papers (overclaims). B: conference guide |
| Assign agenda | Records only | No attendee "my agenda" view exists | — |
| CEU and certificates | Records only | Definitions only; nothing issued | P: certificates-ceu (unpublish) |
| Speakers | Partial | Directory used for speaker badges; not shown on event pages | H: speakers |
| Speaker portal, backstage | Records only | Checklists and notes nobody else sees | H: speakers |
| Sponsors | Works | Profiles appear in the event page sponsor strip once in a confirmed spot | P: sponsors-exhibitors. H: sponsors |
| Sponsorship spots and `/e/<id>/sponsor` | Works | Public prospectus of open spots with an organiser-built enquiry form; spots filled by hand | H: sponsors. Draft page staged |
| Sponsorship packages | Partial | Reusable tiers copied into spots; never sold online | H: sponsors › Sponsorship packages |
| Exhibitor booth sales | Works | Exhibitors pick and pay for booths on a hall map with timed holds and a double-sell guard | H: sponsors › Selling exhibitor booths. P: expo-trade-show-management |
| Floor plan and booths editor | Works | Drag-and-place editor over the sellable booths | H: sponsors › Arranging booths |
| Expo booths (old list), sponsor rooms | Records only | Old records nothing reads | — |

### Broadcast and community

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| Livestream rooms | Partial | Embeds a YouTube, Vimeo or MP4 link in the portal with viewer counts; members only (B12) | P: livestream-webinar-rooms (overclaims). H: broadcast |
| Webinar rooms | Partial | Join link in the portal; members only | H: broadcast › Webinar rooms |
| Breakout rooms | Partial | Rooms with a shared round countdown and broadcasts; assignments ignored | H: broadcast › Running breakout rounds |
| Recordings and public replay | Works | `/r/<id>` replay page and members' Watch library; videos linked, not hosted | H: broadcast › Sharing a public replay page |
| Simulive and on-demand | Partial | Watch library; no synchronised playback | H: broadcast › Simulive |
| Captions and transcription | Demo data | A timer marks a made-up transcript Ready | P: livestream page claims it |
| Mobile event app screen | Records only | Config the unpublished app never reads | — |
| Branded app | Placeholder | Saves nothing; "Build" is a simulated toast | — |
| Event chat with live polls | Works | Group chats in the portal and app with in-chat polls (B9) | P: event-community-engagement. H: community |
| Q&A | Works | Attendees ask in the portal, organisers answer, with audience targeting | H: community › Creating a Q&A thread |
| Messages (organiser inbox) | Works | Buyer support threads answered from the dashboard; replies send no email | H: community › Answering attendee messages |
| Broadcast to an audience | Works | Opens a portal thread with each targeted buyer; in-app only | H: community › Sending a broadcast |
| Announcements | Partial | Shows in portal notifications to everyone, ignoring the audience; email, SMS and schedule never fire | H: community › Creating an announcement |
| Polls (screen), surveys | Records only | Hand-typed counts; live polls live in chat | — |
| Meeting scheduler, discussion boards | Placeholder | Coming Soon | — |

### Memberships and members portal

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| Membership plans | Partial | Sold in the members portal; member discounts never applied | P: memberships. H: memberships |
| Members roster | Works | Plan holders with status and expiry | H: memberships › The Members list |
| Membership purchase | Partial | Free plans enrol instantly; paid plans charge Geiger's Stripe (USD), no renewals | H: memberships › How people join |
| Membership VOD | Works | Plan holders watch recordings for targeted events, with expiry | H: members-portal › Watching recordings |
| Rooms and perks entitlements | Records only | Displayed, never applied | — |
| Portal sign-in and account | Works | Automatic buyer accounts, emailed set-password link, own email and password | H: members-portal |
| Portal tickets, QR, orders, receipts | Works | Tickets with QR, `.ics`, directions and items to collect; itemised receipts | H: members-portal › Tickets and QR codes |
| Mobile app | Placeholder | ~27 screens, never released | — |

### Campaigns, analytics, advertising, workflows

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| Newsletters, reminders, invites, drip, scheduling, templates | Records only | Saved, never sent | P: event-email-sms-marketing (unpublish) |
| Deliverability | Records only | DKIM and SPF are switches, no DNS check | — |
| Segmentation | Partial | Segments work for chat and portal targeting; campaigns never send | H: guests › Building a segment |
| 12 analytics dashboards | Demo data | Hard-coded sample data; CSVs are sample rows | P: event-analytics (unpublish) |
| Scheduled reports | Records only | Nothing generated or emailed | — |
| Advertising (connections, campaigns, budgets, insights) | Records only | No OAuth, hand-typed numbers | — |
| Workflows and templates | Records only | Builder saves workflows nothing runs | P: event-automation (unpublish) |
| Run history | Placeholder | Reads a table nothing writes | — |

### Settings and platform

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| AI Apps and MCP server | Works | Remote MCP server at `/api/mcp` with OAuth; 11 tools including list orders, create and publish events, approve registrations | — |
| Team and members | Partial | Roster synced from the suite org; invites send no email | H: settings › Team and members |
| Roles and permissions | Partial | Custom roles enforced in the dashboard UI only | H: settings › Roles and permissions |
| Notifications | Partial | Switches control the 3 live emails; 49 others are planned | H: settings › Email notifications |
| Add-ons | Works | Per-project switch; Affiliates is the only add-on | H: settings › Add-ons |
| Affiliate programs and commissions | Partial | Per-event programs, tiers, caps, manual approval; attribution only from the buyer's browser, payouts recorded not sent | H: settings › Add-ons. Draft page staged |
| Navigation | Works | Per-user sidebar hiding, shared across the suite | H: settings › Sidebar navigation |
| Operations workspace and `/operations` portal | Works | Presenters, judges, staff and volunteers accept invites, see placements, submit evaluations; notice emails need a scheduler | H: operations |
| API and webhooks, usage | Placeholder | Coming Soon | P: api-webhooks (unpublish) |

### Sourcing and event design

| Feature | Status | What it really does | Coverage |
| --- | --- | --- | --- |
| Venue sourcing | Partial | Live OpenStreetMap venue search and a status pipeline with hand-typed quotes | P: venue-sourcing (overclaims). H: venues › Finding and shortlisting venues |
| Housing and travel | Partial | OpenStreetMap search for stays, airports and stations; room blocks typed by hand | H: venues › Finding stays and tracking room blocks |
| Smart custom proposals, instant book | Placeholder | Coming Soon | P: venue-sourcing claims both |
| Floor plans, object library, seating charts, setup styles, 3D walkthrough, room templates, sharing, diagram library | Placeholder | No screens | P: event-floor-plans-seating claims several |

## What Google can see

- **Blog posts:** 5 of 8 Events posts appeared in Google results during the audit: per-ticket questions, conditional form examples, the conditional-forms buyer checklist, conditional logic in forms, and the alternatives buyer's guide. The other 3 weren't probed.
- **Feature and solution pages:** 0 of 54 by title; discount codes appeared once. They have been live for about three months, so age isn't the reason.
- **Help center:** Events help articles never appeared individually, but Google's AI cited the "Geiger Help Center" for memberships and chat. The 23 articles are the most detailed public description of the product (1,200 to 5,200 words each).
- Exact index status per URL needs Search Console.
