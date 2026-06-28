# Sidebar Feature Plan

Status snapshot + per-sub-item scope for every area in the workspace sidebar
(`components/internal/sidebar/sidebar_nav.jsx`). Companion to
`competitive-feature-matrix.md` (the lane/positioning research) and
`MODULE_CONVENTIONS.md` (how to build a screen).

Lane (from the matrix): _"A modern event platform for communities and small
organizers: beautiful pages, fast ticketing, social momentum, and reliable
check-in without enterprise pricing."_

---

## What's built today

**Events is the only live area.** Everything else in the sidebar falls through to
`ComingSoonScreen` — only `Overview`, `All Events`, `Templates`, and
`Event Series` are wired in `registry.jsx`.

The Events area is the **reference quality bar** for everything else:

- **Workspace screens:** Events home, Overview dashboard, All Events
  (filter/search/CRUD table), Templates, Event Series.
- **Per-event editor** (`event_detail.jsx` + `event_sections.js`) — a tabbed
  editor, _not_ separate registry screens. Live tabs: Overview, Event details,
  Page design (custom page builder), Cover media, Rich description, Schedule,
  Guests, Location & time, Map & directions, Ticket types, Offerings, RSVP
  options, Custom questions, Registration settings, Custom URL, SEO & sharing,
  Add to calendar, Embeddable widget, Localization, Co-hosts & admins,
  Visibility, Time-zone, Hybrid mode, Recurring events.
- UI-first (local sample data), public page renderer at `/e/[id]`, with some real
  Supabase wiring in `lib/supabase/events.js`.

### The architectural rule that drives everything below

**Per-event configuration already lives in editor tabs.** So the top-level
sidebar areas should be **workspace-level, cross-event operational surfaces** —
list / manage / report across _all_ events — not duplicates of the event editor.
Each area below names the **screen to register** and what each **sub-item**
offers.

---

## Registrations

Workspace-level: manage the people-coming pipeline across events. Register a
`RegistrationsScreen` (registrations list with status/source columns).

| Sub-item | What to offer |
| --- | --- |
| RSVPs | Master list of every RSVP across events — status, event, timestamp; bulk actions, export. Cross-event counterpart to the per-event RSVP tab. |
| Registration Forms | Form builder library: reusable field sets the per-event "Custom Questions" tab consumes. |
| Waitlist | Unified waitlist queue per event with position, auto-promotion rules, manual promote/notify. |
| Approval Gates | Pending-approval inbox — approve/deny with reason + auto-email. |
| Capacity Limits | Per-event and per-ticket caps with live fill %, overbooking buffer. |
| Plus-ones | Policy control (allowed count, do plus-ones answer questions) + named-guest roster. |
| Dietary & Accessibility | Aggregated needs report for catering & venue ops; exportable. |
| Token-gated | Wallet/NFT/access-token rules that gate the form. |
| Member-only | Restrict to members list / email domain / Geiger suite membership. |
| Conditional Questions | Logic builder: show question B only if answer A. |
| Group Registration | One registrant signs up a team/table; collect details per seat. |
| Registration Deadlines | Open/close windows per event/ticket with auto-close. |
| Autofill Returning | Recognize returning guests (contact book) and pre-fill known fields. |
| Register on Behalf | Organizer manually adds a registrant (comp/VIP/phone signups). |
| Waitlist Auto-promotion | Rules engine: auto-promote next + time-boxed claim window. |
| Confirmation Page | Editable post-registration screen (what's next, calendar add, share). |

---

## Guests

Workspace-level lightweight CRM (matrix differentiator). Register a
`GuestsScreen` (contact table).

| Sub-item | What to offer |
| --- | --- |
| Guest List | Master attendee table across all events — searchable, with attendance history. |
| Segments | Saved filters (VIPs, no-shows, attended 3+) used for Campaign targeting. |
| Guest Import | CSV / contacts / suite import with column mapping + dedupe preview. |
| Who's Going | Privacy-aware visible attendee list config (public/anonymized/hidden). |
| Consent Tracking | Per-contact marketing/comms consent + timestamp & source. |
| Attendee Export | Filtered CSV/Excel export with field selection. |
| Contact Book | The unified person record reused across all events (CRM backbone). |
| Guest Profiles | Per-person detail: events attended, spend, tags, notes, comms history. |
| Tags & Notes | Freeform tags + internal notes; drives segments. |
| Dedupe & Merge | Detect duplicate contacts (email/phone) and merge histories. |
| Blocklist | Block emails/people from registering or being contacted. |
| Data Requests | GDPR-style export/delete request handling per contact. |
| Communication History | Timeline of every email/SMS/RSVP touch for a contact. |

---

## Tickets

Workspace-level commerce + orders. Register a `TicketsScreen`. Per-event tier
setup already exists in the editor; this area is the money/orders layer.

| Sub-item | What to offer |
| --- | --- |
| Ticket Types | Cross-event view of all tiers with sales status. |
| Coupons | Discount code manager — %/fixed, usage caps, expiry, per-event scoping. |
| Payouts | Connected payout account, balance, schedule & history. |
| Ticket Tiers | Tier templates (GA/VIP/Early) reusable across events. |
| Early-bird Sales | Time/quantity-triggered price changes. |
| Add-ons | Upsell items (merch, parking, workshops) — ties to editor "Offerings". |
| Donations | Pay-what-you-want / optional donation line at checkout. |
| Group Purchasing | Bulk/table buying with per-seat assignment. |
| Taxes | Tax rules by region, inclusive/exclusive, tax IDs on invoices. |
| Refunds | Refund queue — full/partial, policy presets, auto-restock. |
| Payment Plans | Installment schedules for higher-priced tickets. |
| Transfers | Attendee-to-attendee transfer with name change. |
| Reserved Seating | Seat-map builder + pick-your-seat checkout (advanced; defer). |
| Dynamic Pricing | Demand-based price rules (advanced; selective). |
| Anti-scalping & Resale | Controlled resale marketplace + transfer limits (advanced). |
| Multi-currency | Per-event currency + display conversion. |
| Payment Methods | Toggle card/wallet/bank/BNPL; provider config. |
| Invoices & Receipts | Auto receipts + downloadable invoices with branding/tax fields. |
| Order Management | Master orders table — refund, resend, edit, look up a buyer (operational hub). |
| Access-code Tickets | Hidden tickets unlocked by a code. |
| Memberships | Recurring membership granting ticket access/discounts. |
| Affiliate Codes | Trackable seller/affiliate links with commission reporting. |
| Bundles | Multi-ticket/multi-event packages sold as one. |

---

## Check-in

Day-of operations (MVP-critical). Register a `CheckInScreen` (live attendance
console).

| Sub-item | What to offer |
| --- | --- |
| QR Tickets | QR generation + validation rules; the scannable credential. |
| Wallet Passes | Apple/Google Wallet pass issuance & updates. |
| Check-in App | Mobile scanning console — scan, confirm, flag duplicates. |
| Door Sales | On-site sell + instant check-in for walk-ups. |
| Offline Check-in | Local cache + sync so scanning works without signal. |
| Kiosk Mode | Self-serve locked-down tablet check-in. |
| Badge Printing | On-demand badge print on scan (defer/advanced). |
| Session Check-in | Per-session scanning for multi-track agendas. |
| Capacity Control | Live count vs cap with stop-entry alerts. |
| RFID / NFC | Tap credentials (advanced/rare). |
| Smart Badges | Programmable badges w/ lead capture (advanced). |
| Self Check-in | Attendee scans own QR at a gate. |
| Multi-gate & Zones | Multiple entry points/zones with per-gate access rules. |
| Real-time Attendance | Live dashboard of checked-in vs registered, by gate/time. |
| Staff Scanning Roles | Scanner accounts with limited permissions. |
| Lead Retrieval | Exhibitor scan-to-capture-lead (conference). |
| Name-search Lookup | Manual lookup for guests without a QR. |

---

## Analytics

Cross-event reporting. Register an `AnalyticsScreen` (dashboard + chart kit).

| Sub-item | What to offer |
| --- | --- |
| Sales | Revenue over time, by event/tier, net of fees/refunds. |
| Attendance | Registered vs checked-in, no-show rate, trends. |
| Cross-event Reporting | Workspace-wide roll-ups (the differentiator). |
| Traffic & Sources | Page views, referrers, device/geo for event pages. |
| Email Performance | Open/click/bounce per campaign (from Campaigns). |
| Engagement | RSVP -> purchase -> attend funnel + on-page engagement. |
| Sponsor ROI | Booth visits, leads, impressions per sponsor (conference). |
| Real-time Dashboards | Live event-day metrics. |
| Custom Report Builder | Pick metrics/dimensions, save & share. |
| Scheduled Reports | Email a recurring report to stakeholders. |
| UTM Attribution | Campaign attribution by UTM down to revenue. |
| Conversion Funnels | Visualize drop-off across the registration funnel. |
| Revenue Forecasting | Projection based on current pace (advanced). |
| Surveys & NPS | Post-event survey + NPS collection and scoring. |
| Demographics | Aggregate attendee breakdowns from registration data. |

---

## Campaigns

Outbound comms ("should have soon"). Register a `CampaignsScreen` (campaign list
+ builder).

| Sub-item | What to offer |
| --- | --- |
| Newsletters | Recurring broadcast to followers/segments. |
| Automated Reminders | Scheduled pre-event sequences (T-7, T-1, day-of). |
| Email Invites | Branded invites to a segment/import. |
| SMS Invites | Text invites with short links. |
| WhatsApp Invites | WhatsApp Business invites/reminders. |
| Text Blasts | One-off SMS broadcast (Partiful-style). |
| Segmentation | Target by Guest segments. |
| Email Template Builder | Reusable branded email designs. |
| Drip Sequences | Multi-step automated journeys with triggers. |
| A/B Testing | Subject/content split tests with winner pick. |
| Send Scheduling | Schedule + timezone-aware sends. |
| Deliverability | Sender reputation, SPF/DKIM status, bounce handling. |
| Personalization | Merge tags (name, ticket, event). |
| Push Notifications | Mobile/web push for app users. |

---

## Discovery

Public-facing distribution & marketplace (key differentiator). Register a
`DiscoveryScreen`.

| Sub-item | What to offer |
| --- | --- |
| Marketplace Listing | Opt event into the public Geiger discovery feed. |
| City & Category Search | Browsable directory by location/category. |
| Recommendations | "You might like" based on interests/history. |
| SEO Pages | Auto-generated indexable landing pages per event/organizer. |
| Organizer Profile | Public organizer page with all upcoming events. |
| Follow Organizers | Followers + notify-on-new-event. |
| Social Proof | "X friends going" / popularity signals. |
| Featured Events | Editorial/paid featured placement slots. |
| External Distribution | Syndicate to Google Events, social, partner sites. |
| Ratings & Reviews | Post-event attendee ratings on organizer/event. |
| Saved & Wishlist | Attendees save events for later + reminders. |
| Paid Promotion | Self-serve ad boosts within the marketplace. |
| Partner Syndication | Feed events to partner networks via API. |
| Referral Links | Trackable share links with referral credit. |
| Embeddable Lists | Embed an organizer's event list on their own site. |

---

## Community

In-event social engagement (reduces no-shows, builds momentum). Register a
`CommunityScreen`.

| Sub-item | What to offer |
| --- | --- |
| Activity Feed | Per-event feed of RSVPs, posts, updates. |
| Event Chat | Group chat for attendees. |
| Attendee Profiles | Opt-in social profiles for networking. |
| Photo Album | Shared post-event photo upload/gallery. |
| Shared Playlist | Collaborative music playlist (Apple Invites-style). |
| Polls | Live polls during the event. |
| Q&A | Moderated audience questions with upvotes. |
| AI Matchmaking | Suggest who to meet by interests (advanced). |
| Visible Attendee List | Privacy-controlled "who's coming". |
| Mutual Connections | Show shared connections between attendees. |
| Meeting Scheduler | 1:1 meeting booking between attendees (conference). |
| Direct Messaging | Attendee-to-attendee DMs. |
| Live Reactions | Emoji reactions during live moments. |
| Moderation Tools | Report/mute/ban + content filters. |
| Announcements | Organizer broadcast inside the event feed. |
| Gamification | Points/badges/leaderboard for participation. |
| Discussion Boards | Topic threads pre/post event. |

---

## Conference

Separate paid module (matrix: later product line). Register a `ConferenceScreen`
hub. Phase the 28 sub-items rather than building all at once:

- **Core agenda (build first):** Agenda Builder, Speakers, Sponsors, Multi-track
  Sessions, My Agenda, Call for Papers, Speaker Portal.
- **Virtual/hybrid hosting (paid module):** Recordings & Replay, Livestream
  Rooms, Webinar Rooms, Screen Sharing, Breakout Rooms, Speaker Backstage,
  Producer Controls, Simulive & On-demand, Captions & Transcription, Session
  Access Control.
- **Expo & enterprise ops (defer):** Expo Booths, Sponsor Rooms, Floor Plan &
  Booths, Lead Capture, Exhibitor QR Scanning, Sponsorship Packages, Venue
  Sourcing, Housing & Travel, CEU & Certificates, Mobile Event App, Attendee
  Networking, Gamification Passport.

Each maps to a recognizable Cvent/Whova/Bizzabo capability, but per the matrix
this is a later product line, not MVP.

---

## Settings

Workspace admin. Register a `SettingsScreen` (uses `SettingsList`/`SettingRow`
kit + RBAC from `lib/rbac.js`).

| Sub-item | What to offer |
| --- | --- |
| Team & Members | Invite users, manage seats. |
| Roles & Permissions | Map `WORKSPACE_PERMISSIONS` to custom roles. |
| Integrations | Connect Stripe, Zapier, CRMs, the Geiger suite. |
| API & Webhooks | API keys + webhook subscriptions (Team plan). |
| Branding | Logo, colors, fonts applied to pages/emails. |
| Security | Session, password, IP policies. |
| Billing & Plans | Plan, invoices, payment method, fee tier. |
| Multi-event Dashboard | Cross-event admin home for teams. |
| SSO | SAML/OIDC (enterprise; defer). |
| White-label | Custom domain + remove Geiger branding. |
| Support & SLA | Plan-based support tier/contact. |
| Audit Logs | Who-did-what trail (enterprise). |
| 2FA / MFA | Account-level MFA enrollment. |
| Custom Domains | Map your domain to event pages. |
| Sub-accounts | Child workspaces for agencies/multi-brand. |
| Data & Backup | Export/backup workspace data. |
| Sending Domains | Verify email domains (SPF/DKIM) for deliverability. |
| App Marketplace | Install third-party add-ons. |
| Accessibility | Page accessibility defaults/compliance. |
| Localization | Default languages, date/currency formats. |
| Tax & Legal | Tax registration, terms, refund policy, legal entity. |

---

## Recommended sequencing

The sidebar encodes the full ambition; the matrix says ship a focused MVP first.
Register screens in this order:

1. **Check-in** + **Registrations** (RSVPs/Waitlist/Approval) + **Tickets**
   (Order Management/Coupons/Payouts) + **Analytics** (Sales/Attendance) —
   completes the core paid-event + day-of loop (matrix "MVP must-have").
2. **Guests** (CRM) + **Campaigns** (reminders/SMS) — the "modern baseline."
3. **Discovery** + **Community** — the differentiators that make Geiger social.
4. **Conference** + advanced **Settings** — later/paid modules.

Each new screen follows the events-area pattern: register in `registry.jsx` under
the exact sidebar title, seed from a `sample_data.js`, derive lists/stats with
`useMemo`, build from the shared kit (header, stats, toolbar, table), three list
states, semantic tokens only. Per-entity detail becomes tabs in an editor, not
new registry entries.
