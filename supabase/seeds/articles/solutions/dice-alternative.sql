-- solution page: DICE Alternative (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'The DICE Alternative for Independent Promoters',
  'dice-alternative',
  'Anti-scalping, controlled resale, ticket tiers, fast door check-in, and follower momentum — on a platform you run independently, with pricing you can read up front.',
  $html$<p>You went with a mobile-first music ticketing platform because it takes scalpers seriously — mobile tickets that activate in-app, a waiting list that captures demand, and controlled resale that keeps prices honest. That protection is real and it matters. But the model is partner-driven: you sell inside someone else's marketplace and app, on terms set through a partnership rather than a page you can read, and the fans who buy your shows belong to the platform's ecosystem more than to you. For an independent promoter, the anti-scalping is exactly what you want — the dependence on a marketplace is what you don't.</p>

<h2>What independent promoters actually want</h2>
<p>It comes down to keeping the protection while losing the dependence. First, <strong>anti-scalping without lock-in</strong>: you want the resale controls, but on a platform you operate, not a marketplace you're a partner in. Second, <strong>terms you can see</strong>: partner economics are negotiated, so it's hard to compare cost to value before you commit. Third, <strong>a following that's yours</strong>: when demand and fans live in someone else's app, next show's momentum resets instead of compounding. You want scalper protection and independence in the same tool.</p>

<h2>An alternative that keeps the controls and hands you the keys</h2>
<p>Geiger Events gives promoters the anti-scalping mechanics that made the mobile-first platform appealing, on a platform you run yourself, with pricing in the open.</p>

<h3>Anti-scalping, resale, and tiers on one flow</h3>
<p>Cap runaway prices and keep tickets with real fans through <a href="/features/events/event-ticketing-payments">ticketing and payments</a> that carries the controls promoters need — face-value resale, capped transfers, a demand-capturing waitlist for sold-out shows, plus early-bird tiers, release waves, discount codes, and group orders. It's the anti-scalping protection you switched to a mobile-first platform for, on a spine you run yourself. Payments run on Stripe, the rails you already trust.</p>

<h3>Fast door check-in</h3>
<p>Keep the line moving with the <a href="/features/events/event-check-in-app">check-in app</a> — QR scanning that works offline when the venue Wi-Fi drops, with live attendance on the dashboard — so a busy door at a club or a general-admission show runs fast even when the room is packed.</p>

<h3>Follower momentum that's yours</h3>
<p>This is the independence part. Everyone who buys lands in an attendee list you own, and an organizer profile lets fans follow you directly. Instead of demand living in a marketplace's app, your follower base carries from one show to the next and does the marketing for the next date — momentum that compounds because it belongs to you. Announce the next drop to people who already came, and a new date opens closer to sold out than it would starting cold in someone else's feed. Over a season of shows, an owned following is the difference between rebuilding an audience each time and building on the one you already have.</p>

<h2>Pricing you can read, not negotiate</h2>
<p>Instead of terms set through a partnership, our current pricing is published plainly on the <a href="/pricing">pricing page</a>, so you can weigh cost against value before you sell a single ticket. Compare it against the mobile-first platform's own terms — we'd rather you decide with both in front of you than take a claim on faith.</p>

<h2>When the marketplace still makes sense</h2>
<p>In fairness: the established music-ticketing platform brings marketplace discovery and a fan base already inside its app, and for some tours that reach is the whole point. Geiger Events is the alternative for the promoter who'd rather stay independent — keep the anti-scalping, controlled resale, and fast door, but own the fans and read the price. You trade borrowed reach for a following that's actually yours.</p>

<h2>What changes when you run the show</h2>
<p>You keep the scalper protection that drew you to a mobile-first platform. You keep more control because the terms are published, not negotiated. And your fans compound because they follow you, not a marketplace. The anti-scalping was always the right instinct; owning the platform around it is what turns one good night into a run of them.</p>

<blockquote>Built for independent promoters who want anti-scalping, controlled resale, tiers, and fast door check-in — on a platform they run themselves, with fans they own and pricing they can read.</blockquote>

<p>Compare the cost for yourself on the <a href="/pricing">pricing page</a>, or start building your first event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Keep the scalper protection, own the fans',
  'Anti-scalping, controlled resale, tiers, and fast door check-in on a platform you run — with a following that compounds and pricing you can read.',
  'Start with Geiger Events',
  'DICE Alternative for Independent Promoters | Geiger Events',
  'A DICE alternative for independent promoters: anti-scalping, controlled resale, ticket tiers, and fast door check-in on a platform you own, with transparent pricing.',
  array['dice alternative','music ticketing platform','anti-scalping ticketing','concert ticketing software','independent promoter ticketing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
