-- solution page: Universe Alternative (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'The Universe Alternative for Independent Organizers',
  'universe-alternative',
  'Get the same ticket flexibility — unlimited types, add-ons, tiers, payment plans — with a modern page builder, social discovery, and transparent low fees, independent of a large ticketing ecosystem.',
  $html$<p>You chose a DIY ticketing tool because it let you build exactly the ticket setup you wanted — unlimited types, add-ons, checkout questions, tiered pricing, even payment plans — and scan people in at the door. All of that works. What nags is everything around it: the event page feels more like a ticket form than a brand, discovery flows through a large ticketing ecosystem rather than an audience of your own, and the fees on each ticket are one more line you're managing. You have the flexibility. You're just running it inside someone else's machine, on a page that doesn't feel like yours.</p>

<h2>What independent organizers actually want back</h2>
<p>The flexibility isn't the problem — the surroundings are. First, <strong>a form-like page</strong> — ticket options are rich, but the page carrying them doesn't represent you. Second, <strong>ecosystem dependence</strong> — reach and distribution route through a big platform's rails, not a following you control. Third, <strong>fees to manage</strong> — a per-ticket charge that's one more variable on every order. What you want is the same ticket power on your own page, feeding your own audience, at a cost you can read.</p>

<h2>An alternative with the same depth and your own front door</h2>
<p>Geiger Events matches the ticket flexibility you rely on and wraps it in a modern page, social discovery, and an audience that belongs to you — without tying you to a large ticketing ecosystem.</p>

<h3>The ticket flexibility, matched</h3>
<p>Everything you configured before has a home here. <a href="/features/events/event-ticketing-payments">Ticketing</a> supports multiple ticket types, tiers, early-bird timed windows, add-ons, discount codes, group orders, and checkout questions from one flow, with free and paid tickets side by side. Payment-plan-style flexibility for higher-priced tickets fits the same setup, so you're not giving up the granular control that made a DIY tool worth it.</p>

<h3>A page that looks like a brand, not a form</h3>
<p>Instead of a ticket form, build a real event page with cover media, a rich description, and a custom URL in the <a href="/features/events/event-page-builder">visual page builder</a>. The first thing a buyer sees is your event, presented your way — the page and the checkout finally match.</p>

<h3>Your own discovery and audience</h3>
<p>Rather than leaning on a large ecosystem for reach, you build your own. An <a href="/features/events/organizer-profiles-followers">organizer profile with followers</a> and social discovery mean people can find and follow you directly, and everyone who buys lands in your <a href="/features/events/attendee-crm">attendee CRM</a> as a contact you own. Your next on-sale starts with your list and your followers — reach you keep, not distribution you rent.</p>

<h3>Transparent, lower fees</h3>
<p>DIY ticketing tools typically add a per-ticket fee plus processing, and distribution through a larger network can come with its own economics on higher tiers. We keep fees low and state them plainly instead of printing a figure here that could go stale — the current specifics live on the <a href="/pricing">pricing page</a>, laid out with no surprises on the order summary. Payments run on Stripe, so a lower, clearer cost still means a trusted checkout.</p>

<h2>Independence without losing capability</h2>
<p>The move keeps the parts you built your events around — flexible tickets, add-ons, door scanning — and drops the parts that made it feel like someone else's platform. The <a href="/features/events/event-check-in-app">check-in app</a> scans QR tickets, works offline when venue Wi-Fi drops, supports door sales, and shows live attendance, so the door runs at least as smoothly as the tool you're leaving. For organizers running a series, reusable setup and a growing follower base mean each on-sale launches faster than the last.</p>

<h2>What changes when the stack is yours</h2>
<p>You keep the ticket flexibility that made a DIY tool worth choosing. You gain a page that looks like a brand, discovery and an audience you own instead of an ecosystem you depend on, and fees you can actually read. The flexibility was never in question — the surroundings were. This gives you the same power on your own front door.</p>

<blockquote>For independent organizers who want flexible ticketing and door scanning on their own branded page and audience, not inside a large ticketing ecosystem.</blockquote>

<p>Compare the fees for yourself on the <a href="/pricing">pricing page</a>, or start building your next event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Same ticket power. Your own front door.',
  'Unlimited ticket types, add-ons, tiers, and payment plans, plus a modern page builder, social discovery, and transparent low fees — independent of a big ecosystem.',
  'Start with Geiger Events',
  'Universe Alternative for Independent Organizers | Geiger Events',
  'A Universe alternative with the same ticket flexibility — unlimited types, add-ons, tiers, payment plans — on a modern branded page with social discovery and low, transparent fees.',
  array['universe alternative','diy ticketing software','event ticketing platform','sell tickets online','event page builder'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
