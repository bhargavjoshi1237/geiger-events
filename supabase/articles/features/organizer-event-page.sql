-- feature page: Organizer Event Page (Event Wall) (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Your Organizer Event Page',
  'organizer-event-page',
  'The Event Wall is your public storefront — a branded page that lists all your events at one custom URL, that fans can follow for updates on everything you put on next.',
  $html$<p>Individual event pages sell one event. But people don''t follow one event — they follow you. The Event Wall is your organizer storefront: a single public page that lists everything you have on, lives at your own URL, and lets fans follow you so they hear about the next one automatically. It is the front door to your whole calendar, not just tonight''s show.</p>

<h2>One page for everything you run</h2>
<p>Your Event Wall lives at a shareable address — <em>/w/your-slug</em> — and pulls in your upcoming events into a clean, browsable grid. Attendees land once and see the full picture: what''s next, what''s featured, and how to grab a ticket. Instead of scattering links to a dozen separate event pages, you hand out one link that always shows your current lineup.</p>

<h3>Upcoming, past, and featured</h3>
<p>The wall can lead with the events you want front and center — a spotlight for your biggest date, featured cards for the rest — and order them by date or by what''s newest. Show upcoming events by default, or let visitors browse past ones. Each card carries the essentials: date and time, venue and city, and a price cue, linking straight through to the event to buy.</p>

<h2>Make it look like you</h2>
<p>The wall is designed, not generic. Choose a theme and accent, set the content width, pick how many columns the grid uses, and choose between classic cards or image-forward overlay cards. Add a logo, a banner with your title and tagline, and a footer. Left-aligned or centered, spotlight or grid — the layout bends to your brand so the page reads as yours the moment someone arrives.</p>

<h3>Your own custom URL</h3>
<p>Claim a custom slug so the page sits at an address you can say out loud and print on a flyer. It is the link that goes in your bio, your emails, and your posts — one stable home for everyone who wants to know what you''re doing next.</p>

<h2>Turn visitors into followers</h2>
<p>The wall is more than a listing; it is a subscription. Visitors can follow your organizer profile right from the page, so when you announce your next event they hear about it without you buying an ad. Every event you promote quietly grows an audience that comes back on its own — the compounding advantage of owning your storefront instead of renting attention. See <a href="/features/events/organizer-profiles-followers">organizer profiles and followers</a> for how that audience builds over time.</p>

<h2>Where the wall fits</h2>
<p>Each event on the wall is a full <a href="/features/events/event-page-builder">event page</a> with its own <a href="/features/events/event-ticketing-payments">ticketing</a> and checkout, and everyone who buys or follows flows into your <a href="/features/events/attendee-crm">attendee CRM</a>. The wall is the layer above them all — the branded index that ties your individual events into a recognizable presence. Set it up once and it keeps itself current as you add and finish events.</p>

<p>For organizers building something ongoing — a venue, a promoter brand, a community, a creator practice — the Event Wall is the difference between a series of transactions and an actual following. It costs nothing extra to publish; see the <a href="/pricing">pricing page</a> for how plans work. Give people one place to find you, one reason to follow, and every future event starts with a warmer audience.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Your events, one branded storefront',
  'The Event Wall lists everything you run at your own URL, styled to your brand — and lets fans follow you for whatever you put on next.',
  'Start with Geiger Events',
  'Organizer Event Page | Event Storefront | Geiger Events',
  'Build a branded organizer event page at your own URL that lists all your events and lets fans follow you for updates on everything you put on next.',
  array['organizer event page','event storefront','organizer profile page','list all your events','follow an organizer'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
