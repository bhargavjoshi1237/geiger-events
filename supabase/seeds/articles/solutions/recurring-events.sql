-- solution page: Recurring & Series Events (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Recurring & Series Event Software',
  'recurring-events',
  'Run a weekly, monthly, or seasonal series without rebuilding the same event every time — clone from a template, keep your regulars in one CRM, and let followers fill the next date.',
  $html$<p>If you run the same event on a cadence — a weekly class, a monthly mixer, a seasonal supper club, a quarterly summit — you already know the tax. Every edition starts from a blank page you've filled in a dozen times before. You re-enter the venue, re-write the description, re-set the ticket tiers, and re-export last month's attendee list hoping you can reach the people who already love the thing. The event isn't the work. The re-work is the work.</p>

<h2>Why recurring organizers outgrow one-off tools</h2>
<p>Most event tools think in single events. Each one is an island: its own page, its own guest list, its own settings, none of it aware that you'll do it all again in three weeks. So your regulars scatter across a dozen disconnected RSVP links, you have no single view of who keeps coming back, and the marketing resets to zero every cycle because last time's attendees have no standing reason to hear about next time.</p>

<h2>Treat the series as the thing that lasts</h2>
<p>Geiger Events models a series as a first-class object and each date as an instance of it. The pattern persists — venue, branding, ticket structure, page layout — and every new edition inherits it, so setup is a quick edit instead of a rebuild.</p>

<h3>Clone and template, don't rebuild</h3>
<p>Save any event you're happy with as a reusable <a href="/features/events/event-series-recurring">event series</a> or an <a href="/features/events/event-page-builder">event template</a>, then spin up the next date in a couple of clicks. Cover media, description, location and time, custom URL, and ticket setup all carry over. Change the date, tweak what's different, publish. The tenth edition takes as long as changing a headline.</p>

<h3>A CRM that remembers your regulars</h3>
<p>The people who show up again and again are your most valuable asset, and one-off links throw that away. Everyone who registers for any date in the series lands in your <a href="/features/events/attendee-crm">attendee CRM</a>, where you can see attendance history, tag your regulars, build segments, and invite the right people to the right edition. The list grows across the whole series instead of fragmenting per event.</p>

<h3>Followers that compound your reach</h3>
<p>An organizer profile lets people follow you, so your audience accumulates edition over edition. When you announce the next date, it goes to a list that has been building the entire time — not a cold start. Combined with newsletters and automated reminders over email and SMS, a series builds its own momentum: last month's crowd becomes next month's early registrations.</p>

<h3>Free and paid, tier by tier</h3>
<p>Run free community nights and paid ticketed editions from the same place with real <a href="/features/events/event-ticketing-payments">ticketing</a> — tiers, early-bird windows, discount codes for returning members. Payments run on Stripe, and fees are transparent and kept low; the specifics live on the <a href="/pricing">pricing page</a>. When a member should get a better rate every time, that rule follows the series rather than being re-created per date.</p>

<h2>The door, every single time</h2>
<p>A recurring event should get smoother, not shakier, as it grows. The <a href="/features/events/event-check-in-app">check-in app</a> scans QR tickets, works offline when the venue Wi-Fi gives out, and shows live attendance so you know how each edition is tracking against the last. Because the guest data lives in one CRM, you can even see who's a first-timer and who's back for their fifth visit as they walk in.</p>

<h2>What changes when the series is the unit</h2>
<p>Setup time collapses because you clone instead of rebuild. Your regulars stop leaking away because every date feeds one contact book. Marketing compounds because followers and segments carry forward. And the day-of runs the same reliable way whether it's edition one or edition fifty. You get to spend your attention on making each gathering better instead of reassembling the scaffolding around it.</p>

<blockquote>Built for organizers who run the same event on a cadence and want the next date to inherit everything the last one earned — the audience, the setup, and the momentum.</blockquote>

<p>See how the fees compare on the <a href="/pricing">pricing page</a>, or set up your first series today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'The next date should inherit everything the last one earned',
  'Clone from a template, keep every regular in one CRM, and let a growing follower list fill your next edition.',
  'Start with Geiger Events',
  'Recurring & Series Event Software | Geiger Events',
  'Run a weekly, monthly, or seasonal series without rebuilding each event — clone from templates, keep regulars in one CRM, and let followers fill the next date.',
  array['recurring events','event series software','recurring event management','series event platform','recurring event ticketing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
