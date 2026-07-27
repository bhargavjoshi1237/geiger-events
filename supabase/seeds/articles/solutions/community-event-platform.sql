-- solution page: Community Event Platform (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Community Event Platform',
  'community-event-platform',
  'Run a recurring community with beautiful event pages, free and paid tickets, a follower list that fills your next event, and check-in that actually works on the door.',
  $html$<p>You run a community — a meetup, a run club, a creator circle, a local music night — and the events are the easy part. The hard part is everything around them: chasing RSVPs across group chats, rebuilding the same event page every month, guessing how many people will actually show, and starting from zero every time because last month's attendees have no reason to come back. Most tools are either a bare RSVP link with no memory of your regulars, or an enterprise suite priced for a conference team you don't have.</p>

<h2>What breaks when you're growing a recurring community</h2>
<p>The friction compounds. A one-off RSVP form doesn't know who came last time, so you can't tell your regulars about the next one. Free tools stop where paid tickets begin, so the moment you want to cover venue costs you're bolting on a second platform. And the day-of scramble — a printed list, a volunteer squinting at names — undercuts the polish of everything you built before it.</p>

<h2>A home base for the whole community, not just one event</h2>
<p>Geiger Events treats your community as the thing that persists and each event as an instance of it. You get a public organizer presence people can follow, a contact book that remembers everyone who has ever attended, and event pages you can clone or template so the next one is a two-minute job instead of an afternoon.</p>

<h3>Pages worth sharing</h3>
<p>Build an event page with cover media, a rich description, location and time, and a custom URL using the <a href="/features/events/event-page-builder">visual page builder</a>. Save a look you like as a <a href="/features/events/event-templates">template</a>, or set up an <a href="/features/events/event-series-recurring">event series</a> for a weekly or monthly cadence so each edition inherits the last.</p>

<h3>Free and paid, from the same place</h3>
<p>Collect RSVPs for free gatherings and sell tickets when you need to cover a room, all through one <a href="/features/events/event-registration-rsvp">registration flow</a>. When you charge, you get proper <a href="/features/events/event-ticketing-payments">ticketing</a> — tiers, early-bird, discount codes — without switching tools. Fees are transparent and kept low; the exact numbers live on the <a href="/pricing">pricing page</a>.</p>

<h3>Momentum that carries to the next event</h3>
<p>An <a href="/features/events/organizer-profiles-followers">organizer profile</a> lets people follow you, so your audience compounds instead of resetting. Everyone who registers lands in your <a href="/features/events/attendee-crm">attendee CRM</a>, ready to be segmented and invited again. A visible "who's going" list adds the social proof that turns a maybe into a yes.</p>

<h3>Reach people where they are</h3>
<p>Send newsletters, invites, and automated reminders over <a href="/features/events/event-email-sms-marketing">email and SMS</a> so no-shows drop and your regulars never miss a date.</p>

<h2>The door, handled</h2>
<p>On the day, the <a href="/features/events/event-check-in-app">check-in app</a> scans QR tickets, works offline when the venue Wi-Fi doesn't, and shows real-time attendance so you know your numbers as the room fills. No printed list, no bottleneck at the entrance.</p>

<h2>What changes once you adopt it</h2>
<p>Your community stops living in scattered threads and starts compounding. Each event is faster to launch than the last, your follower list does the marketing, paid events are as easy as free ones, and the door runs itself. You spend your time on the part that matters — the actual gathering — instead of the logistics around it.</p>

<blockquote>Built for creators, communities, and local organizers who want beautiful pages, fast ticketing, and social momentum without enterprise pricing.</blockquote>

<p>See how the fees compare on the <a href="/pricing">pricing page</a>, or start building your first community event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'The event platform your community keeps coming back to',
  'Beautiful pages, free and paid tickets, a follower list that fills your next event, and check-in that works on the door.',
  'Start with Geiger Events',
  'Community Event Platform for Recurring Organizers | Geiger Events',
  'Run a recurring community with beautiful event pages, free and paid tickets, follower-driven momentum, and reliable check-in — without enterprise pricing.',
  array['community event platform','recurring events','meetup software','community event management','event platform for creators'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
