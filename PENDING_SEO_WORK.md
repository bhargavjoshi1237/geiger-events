# Pending SEO Work

Status tracker for the Geiger Events SEO program. **What's already live:** 54 pages
in `public.dash_seo_pages` (`product='geiger-events'`, all published) — 22 solutions
(13 use-case + 9 competitor-alternative), 7 core-feature, 25 feature — rendering at
`geiger.studio/solutions/events/<slug>` and `/features/events/<slug>` (nested routing
shipped in geiger-dash). This doc lists what is **not** yet done and how much it
matters for ranking.

Ratings today: **on-page/technical foundation ≈ 7/10**, **complete ranking program ≈
4.5/10** — because the biggest levers (off-page authority + ongoing content depth)
haven't started.

---

## Platform pieces (mostly on geiger-dash)

| Piece | Status | Note |
|---|---|---|
| `/pricing` | ✅ exists (dash) | Same-origin links from the 54 pages resolve. Could still become a proper fee/value + calculator page. |
| `/blog` | ✅ exists (dash) | Blog cluster lives here — needs a publishing cadence to matter. |
| `/docs` | ✅ exists (dash) | Will serve as the **Learn** pages once built out. |
| `/glossary` | ❌ missing | **To build** — glossary/learn cluster (see below). |
| `/solutions/events` + `/features/events` hubs | ⚠️ auto-list only | Render a card grid + one-line generic description. Need curated, keyword-targeted landing copy (see below). |

---

## Priority order (highest ranking impact first)

1. **Off-page authority / backlinks / brand** — the single biggest ranking factor,
   and untouched. `geiger.studio` is a young multi-product domain; competitive terms
   will not move without links + brand signals. Needs a real link-building/PR/brand plan.
2. **Curated hub landing pages** for `/solutions/events` and `/features/events`
   (topical anchors — see Quality section).
3. **Glossary / Learn cluster** — informational content ("how to price early-bird
   tickets", "QR vs wallet check-in", "what is an approval gate") to capture
   top-funnel queries and feed internal links to the money pages. Build on dash
   (`/glossary` new, `/docs` for Learn).
4. **Publishing cadence on `/blog`** — SEO plateaus without fresh content.
5. **Quality/trust upgrades to the 54 pages** (below).

---

## Hub landing pages (what "auto-generated list" means)

`/solutions`, `/features`, and the product hubs `/solutions/events` + `/features/events`
render through `SeoHubPage` — a grid of cards linking to each page, with only a
generic title/description from `PAGE_TYPE_HUB`. There is **no substantial body copy on
the hub itself**, so it reads as navigation, not a landing page.

**Action:** give each product hub real, keyword-targeted content — an intro targeting
a head-ish term (e.g. `/features/events` → "event management features/software"),
grouped sub-sections, and keyword-rich internal links to the child pages. These are
the topical anchors Google reads to understand the cluster.

---

## Quality / trust signals (pending on the 54 pages)

- **No images/screenshots** on any page. `cover_image` is null and there are no
  inline `<img>` (we refused to invent URLs). Result: thinner pages, no image SEO,
  weaker engagement, no rich media. **Add real product screenshots via the Pages
  Studio uploader + inline image tool.**
- **No E-E-A-T proof** — no testimonials, case studies, ratings, or real customer
  logos. Can't fabricate these, but their absence caps trust (E-E-A-T) and conversion.
  Add as real ones exist.
- **"Written as built" risk** — several pages describe not-yet-shipped features
  (most Analytics dashboards, virtual rooms, RFID/NFC, parts of Community / Sourcing /
  Event Design), published behind the "subject to change" disclaimer. Real risk of
  bounce / expectation mismatch until the build catches up — **keep the build ahead
  of indexing.**
- **No FAQ schema** on the 54 pages (only the old homepage had it). Adding a FAQ
  block + FAQ JSON-LD per page is an easy rich-result win.
- **Keyword cannibalization risk** — "ticketing" is spread across a core page, several
  feature pages, and solutions; needs canonical discipline / clear primary page per
  intent so they don't compete with each other.
- **Shared-domain dilution** — events content lives on the suite domain, so "events"
  topical authority is split with the other Geiger products. Nested `/events` clusters
  it, but the domain isn't events-focused; the hub pages + internal linking should
  reinforce the cluster.

---

## Realistic ranking expectations

- **Head terms** ("event management software", "event ticketing software", "best
  event…") — **not near-term.** Owned by G2/Capterra/listicles + high-DA incumbents.
  12–18+ months *with* serious link building, if at all.
- **Comparison / "X alternative"** — **mid-term (3–9 months).** Lower competition,
  high intent, high conversion. Best ROI pages we have.
- **Long-tail feature/solution terms** ("reserved seating ticketing", "event floor
  plan software", "community event platform", "call for papers software") —
  **gradually rankable** as they index and pick up a few links. Where the volume of
  wins is.
- **Ramp:** little for ~2–3 months (indexing + new-content settling), meaningful
  long-tail traffic by month ~4–9 *if* the pricing/hubs/blog/glossary + some backlinks
  land.

---

## Next moves (in-scope, buildable now)

1. Curated `/solutions/events` + `/features/events` hub landing pages (dash).
2. `/glossary` cluster + flesh out `/docs` as Learn (dash).
3. Add FAQ block + FAQ JSON-LD to the 54 pages (geiger-events article content).
4. Add real screenshots to the pages via the Pages Studio.
5. Kick off the off-page/backlink/brand plan (the actual ranking unlock).
6. Blog publishing cadence.

---

*Foundation is solid and honest (7/10). Ranking outcome depends on the off-page +
content-depth work above, which is where the program currently scores ~4.5/10.*
