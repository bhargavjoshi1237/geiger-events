# Geiger Events in Google AI: exposure analysis

Processed 5 Nov 2026 from the raw captures of the 4 Nov audit (Google AI Overviews + AI Mode, 123 queries), plus a live recheck of geiger.studio on 5 Nov. The audit's published summary: https://claude.ai/artifact/Hc7A5if9dEhoL5uY3kLY21

## Headline

| Measure | Result |
| --- | --- |
| Buyer questions (category + use case) that name Geiger | **0 / 35** |
| Brand-context answers that are correct | 8 / 21 (5 mixed, 4 wrong or harmful, 3 lost to other "Geiger"s, 1 with no AI answer) |
| Events feature and solution pages Google showed for their own title | **0 / 54** (1 CAPTCHA) |
| Events pages Google surfaced anywhere in 123 queries | 1 (discount codes, with Eventbrite-alternative text as its snippet) |
| Third-party pages that mention Geiger Events | 0 |
| Wrong facts Google states about us | 9 (2 of them tell buyers not to use us) |

Google knows Geiger Events exists when someone types its name. When a buyer describes their need, Geiger is never in the answer. What Google does know about our features comes from the homepage, `/events`, the changelog and the help center, not from the 54 pages written for that job.

## Data and caveats

- Raw captures are in a temp folder that can be cleared: `C:\Users\space\AppData\Local\Temp\claude\C--Pro-geiger-events\f49d1f02-de19-48b8-b48a-0e7764cb20fb\scratchpad\cdp\` (`out-*/results.json`, one `.txt` + `.png` per query).
- All queries ran from an **Indian IP**. The target market is the US and Canada. The 38-query US/Canada set (`q-us.json`, with `gl=` support in `run-batch.mjs`) was prepared but **never run**, so there is no US baseline yet. Competitor lists below lean Indian (Townscript, KonfHub, BookMyShow, Capterra India).
- Two corrections to the 4 Nov report:
  - It listed 15 of 53 pages as indexed. The saved captures don't support that: none of the 54 title searches returned a geiger.studio result (Google dropped the `site:` filter and showed other sites). Treat all 54 as not visible until Search Console says otherwise.
  - It called "Plus $790/yr, Pro $1,190/yr" garbled. Those are the correct yearly prices (2 months free).

## Exposure states

| State | Meaning | Count |
| --- | --- | --- |
| **A. Known, correct** | Google describes it correctly when asked about Geiger by name | 4 |
| **B. Known, wrong** | Google states something false. Needs correction first | 3 features + 6 company facts |
| **C. Known, weak** | Mentioned only vaguely, or only from the changelog or help center | 17 |
| **D. Page exists, invisible** | We have a geiger.studio page; Google never shows or cites it | 16 features + 22 solution pages |
| **E. Dark** | Built, no public page at all | 8 |
| **Lost** | The query returns other companies named Geiger | 3 queries |

Every feature is invisible for buyer questions (0/35), whatever its brand-level state.

## Feature matrix

"Buyer test" lists who Google named instead of us. "—" means no buyer question covered it.

| Feature | Our page | What Google says when asked about Geiger | Buyer test: who Google names | State |
| --- | --- | --- | --- | --- |
| What Geiger Events is | `/events` (cited) | Correct: ticketing, registration and door in one workspace | — | A |
| Stripe checkout, ticket tiers | event-ticketing-payments | Correct | c01, n01: Eventbrite, Ticket Tailor, TicketSpice, Ticketbud, TicketLeap | A |
| Subscription pricing, 15-day trial | `/pricing` (cited) | Correct ($29/$79/$119; yearly $290/$790/$1,190). Alpha tester $0 plan never mentioned | — | A |
| Door check-in, staff | event-check-in-app | Correct (Door B, guest statuses). **"Offline-ready" is wrong**: offline check-in is still a placeholder screen, so Google is repeating our own page | c03, c04, l16: Eventleaf, Attendium, Guest Manager, RSVPify, Zoho Backstage | A |
| **Per-ticket fee** | none states it | **Wrong**: "Yes, ticket fees are extra on every stack"; "charges standard ticket fees per order" | c08 lowest fees: TixFox, Zeffy, Hi.Events, KonfHub, Ticket Fairy | **B, critical** |
| **Product maturity** | nav "Pre-alpha", pricing "Alpha tester", "beta" | **Wrong, harmful**: "Not production ready … running a paid event: not recommended"; "doesn't operate event ticketing … you might mean Hi.Events" | — | **B, critical** |
| **Affiliates** | none | **Wrong**: "Affiliates: No. There is no documented affiliate system" | l20: HeySummit, TicketSpice, Ticket Tailor | **B + E** |
| Express Lane checkout | none | Correct | — | C |
| Promo codes | discount-codes-promo (surfaced once) | Correct | — | C |
| Release scheduling, dynamic pricing | dynamic-ticket-pricing | Correct (example taken from the showcase event) | — | C |
| Rotating QR, anti-scalping | anti-scalping-resale | Rotating QR known | l15: DICE, Resident Advisor, Ticket Fairy, Shotgun | C |
| Wallet passes | wallet-passes | **Wrong**: Google says we support Apple/Google Wallet, but no pass generation exists. Google is repeating our own page | l21: SimpleTix, Showpass, EpassCard | **B (self-inflicted)**: correct or unpublish the page |
| Custom questions per ticket, conditional forms | event-registration-rsvp + 2 blog posts | Known via the Forms pairing | l01-l03, l05, l09, l10: Jotform, Typeform, Eventbrite, RSVPify, EventCreate. l03 names no clear vendor | C, open slot |
| Assigned seating | reserved-seating, event-floor-plans-seating | "Yes" (m05); vague and mixed with Geiger Furniture (a13) | c06, l07, l08: TicketSpice, Ticketbud, TicketLeap, Ticket Tailor, TicketSource | C |
| Agenda builder | conference-agenda-speakers | Correct, sourced from the changelog | c05: only Sched named | C, open slot |
| Expo booths, floor plans | sponsors-exhibitors, expo-trade-show-management | Correct (m05) | c07, l13: ExpoFP, vFairs, Zoho Backstage, Eventdex, Eventleaf | C |
| Memberships | memberships, membership-organizations | Correct, sourced from the help center | l11: Member Jungle, TidyHQ, Mighty Networks | C |
| Members portal, mobile app | none (help center + changelog) | Correct (m05) | — | C, source at risk* |
| Livestream rooms, recordings | livestream-webinar-rooms, virtual-hybrid-events | Mentioned via help center | — | C |
| Event chat | event-community-engagement | Mentioned via help center | — | C |
| Refund requests | none | Mentioned via help center | — | C |
| Email and SMS, Campaign | event-email-sms-marketing | Campaign integration mentioned | — | C |
| Event pages, page builder | event-page-builder, organizer-event-page | Correct ("public page with schedule, location, FAQ") | — | C |
| Branding, custom domains | custom-domains-branding | "White-label look" | — | C |
| Ticketing + seating + agenda + booths in one tool | conference-event-software, cvent-alternative | Never stated as a combination | c09, n02, l12: Cvent, vFairs, Bizzabo, Whova, Swoogo, PheedLoop, Swapcard. AI says smaller tools "require awkward plugins" | D, clearest edge |
| Badge printing, recurring series, analytics, automation, API and webhooks, attendee CRM, templates, organizer profiles, venue sourcing, venue management, lead retrieval, certificates, call for papers, RFID/NFC, sponsorship spots | one page each | Never mentioned | Mostly untested | D (15) |
| Application approval before payment | none | Unknown | l04, l06: Event Smart, Luma, Eventzilla, CompleteEvent, Eventify | E |
| Waitlist | none | Unknown | l14: Cvent, RSVPify, Accelevents, Tixr, Eventcombo | E |
| Display boards (signage) | none (changelog only) | "Venue display options" at most | l18: only Rise Vision. No ticketing vendor | E, open slot |
| Merch and badge issuing | none | Unknown | l19: spreadsheets, wristbands. No software named | E, open slot |
| Payouts straight to the organizer's own Stripe (shipped 5 Nov) | none | Unknown | — | E, trust answer |
| VIP packages, housing and travel | none | Unknown | — | E |

\* Google's AI cited a changelog entry ("Members mobile app and display boards - v0.0.5") for these features. geiger-dash `0235ce1` (2 Nov) set individual release notes to `noindex`. Once Google recrawls them, that source goes away, possibly before any feature page replaces it.

**Competitor-alternative pages (9: Eventbrite, Luma, Posh, Partiful, DICE, Cvent, Bizzabo, Whova, Universe) and audience pages (13):** none ever surfaced. "Eventbrite alternatives" (c02), "Luma alternative" (l17) and "cheaper than Cvent" (l12) name other tools. "Geiger Events vs Eventbrite" builds its comparison from Ticketsmith, Eventcube and Ticket Fairy, with an unsourced fee line.

## Wrong facts register

| # | Google says | Where it came from | Truth | Fix | Severity | Repo |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Not production ready; don't run a paid event | "Pre-alpha" nav badge on every page; "Alpha tester", "while the beta runs" on pricing | Paid ticketing runs on organizers' own Stripe accounts (since 5 Nov) | Change or drop the badge for Events; add a trust page | Critical | geiger-dash |
| 2 | Geiger doesn't really do ticketing; try Hi.Events | Same label, plus no third-party mentions | Full ticketing product | Fix #1; get listed on third-party sites | Critical | geiger-dash, off-site |
| 3 | Yes, per-ticket fees are extra | `/why-geiger`: "Ticket fees are extra on every stack" | No platform fee; direct charges, Stripe processing only | Rewrite that line; state the fee on `/pricing`, `/events` and every alternative page with a $25-ticket example | Critical | geiger-dash, geiger-events |
| 4 | Based in London | Homepage demo event (The Glasshouse, Southwark) | Not London | `data-nosnippet` + "Example event" label; real location in `/about` and schema | High | geiger-dash |
| 5 | GA about $45, VIP about $120 | Same demo event | Demo prices | Same fix | High | geiger-dash |
| 6 | No affiliate system | No public page | Affiliates add-on is built | Publish `/features/events/affiliates` | High | geiger-dash |
| 7 | Users praise its "markdown-adjacent visual playground"; Glassdoor 4.2 | No reviews exist, so the AI pads with another Geiger | — | Real reviews on G2 and Capterra; Organization `sameAs` | Medium | off-site |
| 8 | Founders not publicly named (m04) vs. Bhargav Joshi (a14, m01) | Only the blog author page names him | Bhargav Joshi | Founder, founding year and location on `/about` + Organization schema | Medium | geiger-dash |
| 9 | "Geiger Studio Events", "Geiger Studio" | Our own pages mix spellings (`/why-geiger` uses "Geiger Studio") | Geiger Studios | Use one spelling everywhere | Low | geiger-dash |

## Brand queries

| Query | State | Note |
| --- | --- | --- |
| Geiger Events | Correct | Cites homepage and `/events` |
| Geiger Studios, geiger.studio | Correct | Disambiguates from Geiger Post, HR Giger, architects |
| Geiger Events check-in app | Correct | Cites `/events` + conditional-forms blog post |
| who owns Geiger Studios | Correct | Bhargav Joshi |
| "The Eventbrite Alternative for Organizers" Geiger | Correct | Only with the exact page title |
| Tell me everything about Geiger Events (AI Mode) | Correct, with invented review sentiment | |
| Feature checklist (AI Mode) | Correct except affiliates | Sourced from changelog + help center |
| Geiger Events pricing | Mixed | Right plans; demo ticket prices; "standard ticket fees per order" |
| Geiger Events vs Eventbrite | Mixed | Built from competitor sources |
| Geiger Events assigned seating | Mixed | Vague; Geiger Furniture |
| Cost and per-ticket fees (AI Mode) | Mixed | "Yes, fees extra" |
| Company and location (AI Mode) | Mixed | London; founders not named |
| Good Eventbrite alternative? (AI Mode) | Wrong | "Doesn't exist, try Hi.Events" |
| Production ready? (AI Mode) | Wrong | "Not recommended" |
| What fee per ticket? (AI Mode) | Wrong | "Fees extra, undisclosed" |
| Geiger Events reviews | Wrong | Invented + Glassdoor of Geiger (promo products) |
| Geiger Events ticketing platform | Lost | Giger App, Geiger promo expos, HR Giger Museum |
| Geiger Flow | Lost | Geiger counters |
| Geiger Notes | Lost | Geiger-Notes AG (stationery); our page ranks in organic only |
| Geiger Events mobile app | No AI answer | Changelog in organic |

## Where buyer answers come from

- **Most-named tools across 35 buyer answers:** Eventbrite 23, Ticket Tailor 7, Jotform 7, Ticketbud 6, Cvent 6, RSVPify 5, TicketSpice 5, Townscript 5, TicketLeap 4, Ticket Fairy 4, Luma 4, Typeform 4.
- **Most-cited source types:** YouTube (7 answers), LinkedIn (3), vendor listicles (getmacha, regform, ticketfairy, tickera), Reddit, Capterra.
- **Open slots, where no vendor dominates:** signage built into ticketing (l18), merch and badge pickup tracking (l19), different questions per ticket type (l03), agenda builder (c05, only Sched), wallet passes for small organizers (l21). Signage, merch pickup and the agenda builder are built. Per-ticket questions are half-built (organizers can't read the answers), and wallet passes don't exist.

## Index and site state (live, 5 Nov)

| Check | State |
| --- | --- |
| geiger.studio URLs Google surfaced | Home, `/events`, `/events/login`, `/pricing`, `/why-geiger`, `/changelog`, `/blog` + 2 posts + author page, `/help/*`, `/teams/*`, `/for/*`, `/privacy`, `/notes`, and once `/features/events/discount-codes-promo` |
| `/solutions/events/*` ever surfaced | Never |
| Bing `site:` for `/features/events` and `/solutions/events` | 0 results (Bing feeds ChatGPT search and Copilot) |
| Near-duplicate pages? | No. 8-27% shared 5-grams between pages, so duplication is unlikely to be the cause. More likely low crawl priority (new domain, no backlinks) |
| Homepage and `/events` link to the 54 pages | 0 links (the `/features` and `/solutions` hubs do link them) |
| "Pre-alpha" badge | Still on every page |
| `/why-geiger` "Ticket fees are extra on every stack" | Still live |
| Homepage demo event (Glasshouse, London) | Still live, no `data-nosnippet` |
| `/events` JSON-LD | None (`app/page.js`) |
| `/events/login` | Indexable, no robots meta (`app/login/page.js`); geiger-dash's own `/login` is noindex since 2 Nov |
| `llms.txt` | 404 |

## Next step: start the correction strategy

Phase 0 (baseline, before writing anything):
1. Export Search Console > Pages for `/features/events/` and `/solutions/events/` to get the real reason for each URL ("Discovered" vs "Crawled - currently not indexed").
2. Run the US/Canada query set (`q-us.json`, 38 queries) so progress is measured in the target market.
3. Move the raw captures out of the temp folder.

Then work in this order:
1. **Correct** (state B): fee statement, maturity label + trust page, demo-event leak, affiliates page, `/about` + Organization schema. Mostly copy changes in geiger-dash. Small fixes in this repo: `/events` JSON-LD, links to the feature pages, `noindex` on `/events/login`.
2. **Get indexed** (state D): link the top pages from the homepage and `/events`, request indexing, add Bing Webmaster Tools + IndexNow.
3. **Turn on the dark features** (state E): pages for approval, waitlist, display boards, merch issuing, payouts to the organizer's own Stripe.
4. **Take the open slots**: answer-first posts plus short YouTube demos for signage, merch issuing and the agenda builder.
5. **Get third-party mentions**: Capterra/G2/AlternativeTo, Product Hunt, Crunchbase, LinkedIn, MCP directories.
6. **Re-run monthly**: success means the 0/35 figure moves, starting with the open slots.

## Progress, 5 Nov (uncommitted)

Decisions: the Events badge becomes **Early access**. The fee line is **"No platform fee. You pay only Stripe's standard processing fee, straight to Stripe."**

| Fix | Where | State |
| --- | --- | --- |
| Badge "Pre-alpha" → "Early access" | geiger-dash migration `20261105170000_early_access_badge.sql` + `PRODUCT_BADGES`; geiger-ui default in `suite-mega-menu.jsx` | Needs `db:push`, geiger-ui push and SHA pin |
| "Ticket fees are extra" → no platform fee; FAQ answer added | geiger-dash `/why-geiger` | Done in code |
| Beta strip copy → "early access" | geiger-dash `beta_signup.jsx`, `plans.js` defaults | Done in code |
| Pricing FAQ fee answer, plan renamed "Early access" | `pricing_versions` (DB) | Staged in `go-live.mjs` |
| Demo event labelled "Example event", `data-nosnippet`; fee line | geiger-dash `EventsPlaygroundShowcase.jsx` | Done in code |
| Organization schema: founder, alternateName; `/about` "open alpha" → early access | geiger-dash `app/page.js`, `app/about/page.js` | Done in code |
| `/events` JSON-LD (SoftwareApplication + FAQPage), fee FAQ, guide index linking every feature/solution page, format cards linked | geiger-events `landing_page.jsx`, `lib/landing/event-guides.js` | Done in code |
| `noindex` on login, members, workspace and on-site tools | geiger-events `app/*/layout.js` | Done in code |
| `/issue` desk crash (missing `view` state) | geiger-events `issue_desk.jsx` | Fixed |
| New feature pages: signage, merch pickup, approval, affiliates, VIP packages, sponsorship prospectus | `dash_seo_pages` drafts | Staged in `go-live.mjs` (unpublished) |
| Overclaim and fee corrections on the 54 published pages | `dash_seo_pages` | Staged in `go-live.mjs` |

### Release dependency

The fee wording says payments go to the organizer's own Stripe account. That is true of the Stripe Connect code on `main` (544f418). But `@geiger/pay` was marked untested against Stripe, and the `pay` schema may not be applied. Run one real test payment on a connected account before deploying the copy.

### Product gaps found while checking claims (not advertised)

- Waitlist is manual only.
- Per-ticket-type answers can't be viewed by organizers.
- There is no conditional logic in checkout.
- Refunds are records only, and the UI says "Refunded".
- "Resend receipt" and "Generate invoice" send nothing.
- Only 3 emails are live.
- The mobile app is unpublished.
- Paid memberships still charge Geiger's own Stripe account.
- Inventory tables allow anonymous read and write (security).

## Blog plan: 10 posts, only on features that work today

Publish with real dates, 2-3 a week. Each post answers in its first two sentences, names an author and links to the matching feature page.

1. What Geiger Events charges per ticket: no platform fee, compared on a $25 ticket with Eventbrite, Luma and Ticket Tailor (dated prices). *After the Connect test payment.*
2. Venue screens that update themselves from your agenda: digital signage built into an event platform. *Open slot.*
3. How to stop attendees collecting merch or badges twice. *Open slot; fix inventory RLS first.*
4. Approve attendees before they pay: application-based registration, step by step.
5. Ticketing, assigned seating, agenda and exhibitor booths in one tool, without Cvent pricing.
6. Selling VIP and hospitality packages with a dedicated enquiry page.
7. A sponsorship prospectus page that lists your spots and collects enquiries.
8. Affiliate and promoter tracking for event tickets: links, codes and a commission ledger.
9. Reserved seating for a 300-seat community theatre: setup and real cost.
10. Door check-in for a small team: staff codes, roles, and search by name or order (online only; offline isn't built yet).

Left out until built: automatic waitlists, conditional registration questions, wallet passes, offline check-in, automated reminders, a downloadable attendee app.

## Audit of the 54 published pages (5 Nov)

The audit staged 336 minimal text corrections across 43 pages (243 high, 60 medium, 33 low) in `go-live.mjs` / `corrections.json`. They cover:
- fee claims (77)
- anti-scalping, resale and transfers (35)
- offline check-in (34)
- reminders, SMS and emails (24)
- lead retrieval (22)
- memberships (20)
- follower notifications (14)
- waitlist (14)
- demo analytics (12)
- wallet passes (8)
- faked transcription (6)
- zones (4)
- 6 mismatched links

**Unpublish or rebuild:** the core feature behind these 8 pages doesn't work: wallet-passes, lead-retrieval, anti-scalping-resale, dynamic-ticket-pricing, event-email-sms-marketing, event-analytics, event-automation, api-webhooks.

**Seeds:** 20 seed files in `supabase/seeds/articles/` still carry the old claims, so update them too, or a re-seed undoes the fixes.

The `/events` landing copy had the same issues (wallet passes, automated follow-up emails, live insights on demo data, guests joining a waitlist, captions and transcripts, reminders), and they're fixed in code.
