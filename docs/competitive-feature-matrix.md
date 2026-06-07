# Competitive Feature Matrix

Research date: 2026-06-06

Purpose: build a source-backed feature/function inventory for modern event platforms, rank features from common to rare, then choose the feature set that makes Geiger Events relevant at an attractive price.

## Decision Frame

Geiger Events should not try to beat every platform at once. The strongest initial lane is:

- Modern self-serve events for creators, communities, local businesses, workshops, nightlife, meetups, and small conferences.
- Strong enough for paid events and day-of check-in.
- Lighter, cheaper, and more social than enterprise suites.
- More polished and organizer-friendly than generic RSVP or ticketing tools.

## Competitor Categories

| Category | Competitors | Main Buyer |
| --- | --- | --- |
| Consumer discovery and ticketing | Eventbrite, Fever, Ticketmaster, SeatGeek, Universe, DICE | Attendees and paid event organizers |
| Social invitations and lightweight events | Partiful, Evite, Apple Invites | Hosts, friend groups, casual organizers |
| Community events | Luma, Meetup, Posh | Creators, communities, recurring organizers |
| Conference and event operations | Cvent, Bizzabo, Whova, Splash, Swoogo | Companies, conferences, field marketing teams |
| Virtual and hybrid conferences | Cvent, Bizzabo, Whova, Hopin/RingCentral Events, Airmeet, Zoom Events | Remote conferences, webinars, summits, online communities |

## Feature Taxonomy

| Area | Features |
| --- | --- |
| Event creation | Event pages, templates, cover media, rich descriptions, location/date/time, public/private visibility, recurring events, clone event, custom URL, custom questions, co-hosts/admins |
| Discovery | Marketplace listing, city/category search, recommendations, SEO pages, organizer profiles, follow organizers, friend/social proof, featured events, external distribution |
| Invitations and CRM | Guest import, email invites, SMS invites, WhatsApp invites, newsletters, automated reminders, text blasts, segmentation, consent tracking, attendee export |
| RSVP and registration | RSVP, waitlist, approval gates, capacity limits, custom forms, plus-ones, dietary/accessibility questions, token-gated registration, member-only registration |
| Ticketing and payments | Paid tickets, free tickets, ticket tiers, timed sales, coupons, group purchasing, add-ons, donations, taxes, refunds, payouts, payment plans, transfer tickets |
| Social and engagement | Visible attendee list, comments/activity feed, event chat, attendee profiles, mutual friends/social links, shared photo album, shared playlist, polls, Q&A |
| Day-of operations | QR tickets, Apple/Google Wallet passes, check-in app, door sales, offline check-in, kiosk mode, badge printing, session check-in, capacity control |
| Conference operations | Agenda builder, multi-track sessions, speaker pages, sponsor/exhibitor pages, lead capture, exhibitor QR scanning, session recordings |
| Virtual conference hosting | Hosted livestream rooms, webinar rooms, speaker backstage, producer controls, screen sharing, chat/Q&A/polls, breakout rooms, virtual expo booths, sponsor rooms, attendee networking, session access control, replay library |
| Organizer analytics | Sales dashboard, attendance dashboard, traffic/source analytics, email performance, guest export, engagement analytics, sponsor ROI, cross-event reporting |
| Platform/admin | Team permissions, role-based access, multi-event dashboard, integrations, API/webhooks, SSO, white-label branding, compliance/security, support levels |
| Advanced/rare | Reserved seating, dynamic pricing, anti-scalping/waitlist resale, RFID/NFC access, smart badges, venue sourcing, housing/travel management, AI matchmaking |

## Competitor Feature Summary

| Platform | Strengths | Notable Features | Pricing Signal |
| --- | --- | --- | --- |
| Eventbrite | Broad self-serve ticketing and discovery | Marketplace, event pages, ticketing, paid/free events, email campaigns, organizer app, check-in, ads/promotions, analytics | Free publishing; US paid tickets show 3.7% + $1.79 service fee plus 2.9% processing in official help |
| Luma | Modern community events | Clean event pages, calendars, newsletters, SMS/WhatsApp/email reminders, paid tickets, approvals, token gating, guest CSV, check-in, custom URLs, API/Zapier on paid plan | Free with 5% platform fee on paid events; Plus $59/mo billed annually with 0% platform fee |
| Partiful | Social, fun, low-friction invitations | RSVP by phone, shareable links, text blasts, guest questions, photo album, visible social energy, ticketing, chip-in/payments | Free events no fees; ticketing uses transparent guest-paid service fee, e.g. $10 host payout can display as $12 guest price |
| Posh | Social discovery for creator/nightlife events | Immersive event feed, organizer/friend follows, free/paid pages, ticket tiers, team management, marketing suite, door scanning, social guest list controls | Public app listings emphasize organizer tools; third-party summaries cite attendee ticket fees rather than organizer SaaS pricing |
| Meetup | Community and recurring events | Groups, local search, suggested events, organizer tools, recurring communities, member discovery | Organizer subscription model; useful as pattern, less direct for ticketing-first product |
| Evite | Mainstream invitations | Email/SMS invites, RSVP tracking, reminders, guest messaging, comments/photos/feed, Canva import | Free/premium invitation model |
| Apple Invites | Ecosystem personal invites | Custom invites, RSVP, weather/directions, shared albums, Apple Music playlists | Requires iCloud+ to create; anyone can RSVP |
| Ticketmaster | Large-scale ticketing and venue access | Primary/resale tickets, verified tickets, mobile wallet, transfers, sell tickets, venue entry, ticket upgrades, bundles, official marketplace | Enterprise/partner economics; not a small-organizer SaaS benchmark |
| SeatGeek | Ticket marketplace | Buy/sell/transfer tickets, mobile entry, deal score, seat views, resale marketplace | Marketplace model; not an event creation benchmark |
| Fever | Curated live-entertainment marketplace | Discovery, demand generation, ticketing, onsite ops, analytics, mobile checkout, timed-entry and industry-specific ticketing | Partner/custom pricing |
| DICE | Music ticketing and anti-scalping | Mobile tickets, in-app activation, waiting list, controlled resale, demand visibility for promoters | Partner/ticketing model; feature pattern more important than price |
| Universe | DIY ticketing in Ticketmaster ecosystem | Ticket pages, unlimited ticket types/add-ons, checkout questions, door scanning, tiered ticketing, payment plans, Ticketmaster distribution on higher tier | Starter/Standard show 2% + $0.59 per ticket plus processing/VAT where applicable; Pro custom |
| Cvent | Enterprise event suite | Registration, venue sourcing, attendee hub, mobile app, Q&A/polls/gamification, OnArrival check-in, badging, session control, virtual/hybrid event delivery, travel/housing, integrations | Custom quote |
| Bizzabo | B2B event marketing and operations | Unlimited events/registrations, registration, website builder, email campaigns, mobile app, onsite check-in, badges, sponsors, analytics, virtual/hybrid experiences, Klik smart badges | Starts at $499/user/mo billed annually, 3 user minimum, or $17,999/year |
| Whova | Conference app and attendee engagement | Agenda, personalized schedules, networking, registration, badges, check-in, announcements, sponsors/exhibitors, live/virtual engagement | Custom quote; registration fees shown inside organizer dashboard |
| Splash | Branded event marketing | Designer event pages, registration forms, emails, ticketing, CRM integrations, mobile/offline check-in, kiosk mode, reporting | Custom quote |
| Swoogo | Flexible event management | Unlimited events/registrations, custom registration, website builder, email marketing, check-in app, badges, integrations, API/webhooks, analytics, hotels, virtual hub | Professional listed at $11,800/year for one full user and one reporting user |
| Hopin/RingCentral Events | Virtual and hybrid conference platform | Virtual stages, sessions, expo, networking, registration, sponsor areas, analytics, replay/recordings | Paid event platform pricing; enterprise/custom plans common |
| Airmeet | Virtual/hybrid events and webinars | Webinar rooms, virtual conferences, backstage, networking tables, expo booths, sponsor areas, engagement tools, recordings, analytics | Tiered SaaS/custom pricing |
| Zoom Events | Webinar and virtual event hosting | Multi-session events, webinars, lobby, backstage/session controls, registration, expo/networking options, recordings, analytics | SaaS add-on/plan pricing |

## Feature Rarity Ranking

| Rarity | Features | Interpretation |
| --- | --- | --- |
| Very common | Event page, RSVP/registration, free tickets, paid tickets, guest list, email confirmation, basic analytics, basic check-in | Table stakes. Missing these makes the product feel unfinished. |
| Common modern | Custom questions, ticket tiers, coupons, capacity limits, public/private events, co-hosts, event cloning, automated reminders, attendee export | Expected by serious organizers. Good MVP-plus territory. |
| Increasingly expected | SMS/text blasts, WhatsApp reminders, wallet passes, approval gates, waitlist, visible attendee list, organizer profiles, follow organizers, event chat/comments | Important for a modern app. These create social momentum and reduce no-shows. |
| Differentiating for small organizers | Discovery feed, friend/social proof, newsletters, CRM-lite segmentation, door sales, offline QR check-in, photo album, recurring community calendar, guest import from contacts | Strong candidates for Geiger Events differentiation. |
| Advanced operational | Badge printing, kiosk mode, session check-in, multi-track agendas, sponsor/exhibitor pages, lead capture, CRM integrations, API/webhooks, white-label domains | Valuable but should be later unless targeting conferences immediately. |
| Virtual conference suite | Hosted video stages, webinar/session rooms, speaker backstage, producer controls, chat/Q&A/polls, breakout rooms, expo booths, replay library | Relevant if Geiger Events wants to serve virtual conferences, not just in-person events. This is a separate product surface, not a small add-on. |
| Rare / enterprise | Venue sourcing, hotel/travel management, SSO, complex permissions, cross-event ROI dashboards, gamification, hybrid streaming studio, compliance-heavy controls | Mostly enterprise. Avoid early unless a paying customer demands it. |
| Extremely rare | RFID/NFC, smart badges, dynamic pricing, reserved seating, controlled resale/waitlist marketplace, AI matchmaking, token-gated registration | Differentiators, but high complexity. Use selectively. |

## Recommended Geiger Events Feature Picks

### MVP: Must Have

- Event creation with strong visual page builder.
- Public/private events.
- RSVP and registration.
- Paid/free ticket types.
- Guest list management.
- Custom registration questions.
- Email confirmations and reminders.
- QR code tickets.
- Mobile-friendly check-in.
- Basic organizer dashboard: RSVPs, paid tickets, revenue, checked-in count.

### Modern Baseline: Should Have Soon

- SMS/text blasts.
- Approval gates and waitlist.
- Coupons and early-bird ticket tiers.
- Co-host/team roles.
- Event cloning and recurring events.
- Attendee export.
- Organizer profile pages.
- Visible "who's going" with privacy controls.
- Apple/Google Wallet passes.

### Differentiators To Consider

- Social discovery feed by city/category.
- Follow organizers and notify followers.
- Friend/mutual attendance signals.
- Event chat or lightweight activity feed.
- Shared post-event photo album.
- Newsletter/calendar for recurring organizers.
- Transparent pricing calculator on event setup.
- Low-fee positioning against Eventbrite for self-sourced organizers.

### Conference / Virtual Conference Expansion

If Geiger Events competes in the conference sector, virtual hosting needs to be treated as its own product module:

- Hosted main stage and session rooms.
- Speaker backstage with host/producer controls.
- Moderator controls for mic/camera, screen share, chat, Q&A, and polls.
- Breakout rooms and attendee networking tables.
- Sponsor/exhibitor booths with lead capture.
- Session access control by ticket type or registration status.
- Recording, replay library, and post-event content access.
- Virtual lobby with agenda, live-now state, announcements, and sponsor placement.
- Analytics for attendance, watch time, chat/Q&A engagement, booth visits, and replay views.

This is relevant, but it should probably be a paid conference module or later product line. Building video hosting and media controls into the core MVP would expand scope significantly.

### Defer Unless Strategy Changes

- Badge printing.
- Sponsor/exhibitor portals.
- Multi-track conference management.
- Full virtual conference hosting.
- Media room/backstage/producer controls.
- Venue sourcing.
- Hotel/travel management.
- Full CRM integrations.
- SSO and enterprise compliance.
- Reserved seating.
- RFID/NFC/smart badges.

## Pricing Strategy Hypothesis

The biggest opening is transparent, creator-friendly pricing:

- Free events should stay free.
- Paid events should be cheaper and clearer than Eventbrite for small tickets.
- Offer a simple per-ticket fee plus optional monthly plan.
- Avoid enterprise-style "contact sales" for the main self-serve product.

Possible pricing model to test:

| Plan | Target | Price Concept |
| --- | --- | --- |
| Free | Casual hosts and free community events | $0 for free events |
| Starter ticketing | Small paid events | Low percentage plus small fixed fee, clearly shown to organizer and buyer |
| Organizer Pro | Recurring organizers | Monthly plan that reduces or removes platform fee, adds SMS/newsletter/advanced branding |
| Venue/Team | Multi-event teams | Higher monthly plan with roles, exports, API/webhooks, priority support |

## Initial Product Positioning

Geiger Events can aim to be:

"A modern event platform for communities and small organizers: beautiful pages, fast ticketing, social momentum, and reliable check-in without enterprise pricing."

## Source Notes

- Eventbrite features and fees: https://www.eventbrite.com/features, https://www.eventbrite.com/fees/, https://www.eventbrite.com/help/en-ca/articles/755615/
- Luma pricing and features: https://luma.com/pricing
- Partiful features and ticketing fees: https://partiful.com/, https://help.partiful.com/hc/en-us/articles/49479024950299-What-fees-does-Partiful-charge
- Posh app features: https://apps.apple.com/us/app/posh-create-find-events/id1556928106
- Meetup discovery: https://help.meetup.com/hc/en-us/articles/360004186552-Finding-an-event
- Evite features: https://www.evite.com/
- Apple Invites: https://support.apple.com/en-gb/guide/apple-invites/dev5266f8d6d/ios
- Ticketmaster fan and organizer platform: https://business.ticketmaster.com/solutions/ticket-sales/
- SeatGeek app features: https://apps.apple.com/us/app/seatgeek-buy-event-tickets/id582790430
- Fever business platform: https://business.feverup.com/
- DICE waiting list: https://dice.fm/blog/identify-fan-demand-with-the-waiting-list
- Universe pricing/features: https://www.universe.com/pricing
- Cvent pricing/features: https://www.cvent.com/en/event-management-software/cvent-pricing
- Bizzabo pricing/features: https://www.bizzabo.com/pricing
- Whova features: https://whova.com/
- Splash pricing/features: https://splashthat.com/pricing
- Swoogo pricing/features: https://swoogo.events/pricing
