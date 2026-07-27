# SEO / Marketing pages (`supabase/articles`)

Idempotent `INSERT`s into **`public.dash_seo_pages`** (the geiger-dash Pages Studio
table, shared Supabase project). Each `.sql` file is **one page**. Push them — and
nothing else — with:

```bash
npm run db:push:articles          # = node scripts/run-sqls.js --articles
```

The runner walks this folder recursively, runs every `*.sql`, and skips the normal
`supabase/sqls` schema files and the `--clean` step. Before inserting it **ensures
the `(product, page_type, slug)` unique index** exists (replacing the older
`(page_type, slug)` one) so the `on conflict` clause resolves. Re-running is safe:
every insert ends in `on conflict (product, page_type, slug) do nothing`, so a page
is never duplicated. To change a live page, edit it in the Pages Studio (or the row),
not by re-pushing.

## URL shape (nested under product)

Pages nest under the product inside the existing publishing routes:
`geiger.studio/solutions/events/<slug>` and `geiger.studio/features/events/<slug>`.
The `events` segment is the product id (from `product = 'geiger-events'`). Because
the unique key is **`(product, page_type, slug)`**, every suite product owns its own
slug space — `/solutions/events/community-platform` and `/solutions/flow/…` can
coexist, and a generic slug like `api-webhooks` can **never** collide across products.
The geiger-dash routes render `/{type}/{product}/{slug}`, 301-redirect any legacy
flat `/{type}/{slug}` to the nested canonical, and expose the nested URL in the
sitemap, breadcrumb (Home › Type › Events › Page), and canonical tag.

The `--articles` preflight is now purely informational — it reports how many pages
are new vs already Events-owned (an idempotent re-run).

## Target table (real columns — do not invent others)

`public.dash_seo_pages`: `page_type` (`solution|product|feature`), `product`,
`title`, `slug`, `excerpt`, `content` (HTML fragment), `hero_heading`,
`hero_subheading`, `hero_cta_text`, `meta_title`, `meta_description`,
`keywords TEXT[]`, `cover_image`, `is_published`, `is_featured`, `published_at`.
Unique key: **`(product, page_type, slug)`**. Public URL: `/{solutions|features|product}/<product>/<slug>`.

## File template (copy this exactly)

```sql
-- <type> page: <human title> (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',                       -- page_type: solution | feature
  'geiger-events',                  -- product (fixed)
  'Community Event Platform',       -- title (H1)
  'community-event-platform',       -- slug (kebab, matches manifest)
  'One-sentence summary.',          -- excerpt
  $html$<p>…full HTML fragment…</p>$html$,   -- content (dollar-quoted)
  'Hero heading',
  'Hero subheading sentence.',
  'Start with Geiger Events',       -- hero_cta_text
  'Meta title under ~60 chars',
  'Meta description, 150-160 chars, concrete value + reason to click.',
  array['keyword one','keyword two','keyword three'],
  true,                             -- is_published (published per project decision)
  false,                            -- is_featured
  now()                             -- published_at
)
on conflict (product, page_type, slug) do nothing;
```

Wrap `content` in `$html$ … $html$` dollar quotes so apostrophes/quotes in copy
never break the statement. The runner keeps dollar-quoted bodies intact.

## Hard rules (non-negotiable — this is why the pages are trustworthy)

1. **Never fabricate numbers.** No fees, %, prices, currency counts, payout
   schedules, attendee counts, customer names, testimonials, awards, or
   integrations that aren't verified in the product. Ticketing/pricing pages use
   qualitative language ("transparent, lower fees") and **link to `/pricing`** for
   specifics — never state a figure.
2. **No invented images.** Leave `cover_image` out of the insert (defaults null)
   and do **not** put `<img>` tags with made-up URLs in `content`. The author adds
   real screenshots in the studio.
3. **Stay inside the product taxonomy.** Describe only capabilities that appear in
   `components/internal/sidebar/sidebar_nav.jsx` + `.../screens/registry.jsx`.
   Don't invent features.
4. **Disclaimer.** End every `content` body with this exact line:
   `<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>`
5. **Content = clean HTML fragment.** Only `<h2> <h3> <p> <ul> <ol> <li> <strong>
   <em> <blockquote>`. No `<html>/<head>/<body>`, no markdown, no code fences,
   no `<h1>` (the title renders it), 700–1000 words.
6. **Internal links.** Link 2–4 related pages by their real path, e.g.
   `<a href="/features/event-ticketing-payments">ticketing</a>`, and link
   `/pricing` where money is mentioned.
7. **Voice.** Specific, organizer-to-organizer. Avoid AI tells ("seamless",
   "unlock", "it's worth noting", "in conclusion", "streamline your workflow").
8. `is_published = true`, `product = 'geiger-events'`, CTA usually
   `'Start with Geiger Events'`.

## Manifest — the complete page set (slugs are the anti-duplication key)

One file per row below, named `<slug>.sql`, in the listed folder. Nothing else,
nothing missing.

### `solutions/` — page_type `solution` (audience & use-case)
| slug | Page |
|---|---|
| community-event-platform | Community & meetup organizers |
| creator-events | Independent creators |
| nightlife-club-ticketing | Clubs & nightlife promoters |
| festival-ticketing | Festivals & multi-day events |
| workshop-class-registration | Workshops, classes & courses |
| nonprofit-fundraising-events | Nonprofits & fundraisers |
| membership-organizations | Membership orgs, clubs & associations |
| local-business-events | Local & small business events |
| recurring-events | Recurring / series organizers |
| conference-event-software | Conferences & summits |
| virtual-hybrid-events | Virtual & hybrid events |
| expo-trade-show-management | Expos & trade shows |
| corporate-b2b-events | Corporate & B2B field marketing |
| eventbrite-alternative | Eventbrite alternative (switchers) |

### `core-features/` — page_type `feature` (the pillars)
| slug | Page |
|---|---|
| event-page-builder | Event pages & visual builder |
| event-registration-rsvp | Registration & RSVP |
| event-ticketing-payments | Ticketing & payments |
| event-check-in-app | Check-in & on-site operations |
| attendee-crm | Attendee CRM & contacts |
| event-email-sms-marketing | Email & SMS campaigns |
| event-analytics | Analytics & reporting |

### `features/` — page_type `feature` (long-tail capabilities)
| slug | Page |
|---|---|
| event-templates | Reusable event templates |
| event-series-recurring | Event series & recurring events |
| organizer-event-page | Organizer storefront (Event Wall) |
| venue-management | Venue management |
| event-floor-plans-seating | Floor plans, seating charts & diagramming |
| venue-sourcing | Venue & supplier sourcing |
| reserved-seating | Reserved seating |
| dynamic-ticket-pricing | Dynamic pricing |
| anti-scalping-resale | Anti-scalping & controlled resale |
| discount-codes-promo | Discount codes & coupons |
| wallet-passes | Apple & Google Wallet passes |
| badge-printing | On-site badge printing |
| lead-retrieval | Exhibitor lead retrieval |
| rfid-nfc-access | RFID / NFC access & smart badges |
| memberships | Memberships & recurring access |
| event-automation | Event automation & workflows |
| organizer-profiles-followers | Organizer profiles & followers |
| event-community-engagement | Community: polls, Q&A, chat |
| conference-agenda-speakers | Agenda builder & speakers |
| sponsors-exhibitors | Sponsors & exhibitors |
| call-for-papers | Call for papers & speaker portal |
| certificates-ceu | CEU & certificates |
| livestream-webinar-rooms | Livestream & webinar rooms |
| api-webhooks | API & webhooks |
| custom-domains-branding | Custom domains & white-label |

**Total: 46 pages** (14 solutions · 7 core-features · 25 features).
