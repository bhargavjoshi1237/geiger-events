-- solution page: Events for Local & Small Businesses (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Events for Local & Small Businesses',
  'local-business-events',
  'Put up a simple paid event or free RSVP in minutes, send reminders that fill the room, and turn one-time attendees into repeat customers with a contact list you own.',
  $html$<p>You run a business, not an events team — but events are how you fill slow nights, launch something new, and give regulars a reason to come back. The trouble is that setting one up feels out of proportion to the payoff. The ticketing sites are built for arena tours, the free tools look unprofessional next to your storefront, and none of them help with the part that actually matters to a local business: getting the same people to come back next time. So you run one event, it goes fine, and then everyone you gathered disappears.</p>

<h2>Why events feel like too much work for a small business</h2>
<p>The tools are the wrong size. Enterprise ticketing is overkill and priced like it. A bare RSVP form doesn't look like your brand and forgets everyone the second it's over. Reminders are manual, so a class or a tasting you promoted three weeks ago runs to a half-empty room. And there's no thread connecting the people who came tonight to your next event — the one lever that turns events from a one-off into a habit for your regulars.</p>

<h2>Right-sized events that bring people back</h2>
<p>Geiger Events is quick to set up, looks like your business, and — most importantly for a local shop — turns the people who show up into a list you can invite again.</p>

<h3>Live in minutes, looks professional</h3>
<p>Take free RSVPs or sell paid spots with a simple <a href="/features/events/event-registration-rsvp">registration flow</a>, on a page you build in minutes with the <a href="/features/events/event-page-builder">visual page builder</a>. It carries your name and looks like part of your storefront, not a generic form — so sharing it on your socials or in the shop feels on-brand.</p>

<h3>Charge when it's paid, cleanly</h3>
<p>When the class, tasting, or dinner is paid, collect it through <a href="/features/events/event-ticketing-payments">ticketing and payments</a> powered by Stripe — no second tool, no complexity you don't need. Fees are transparent and kept low, which matters on a small margin; the numbers are on the <a href="/pricing">pricing page</a>.</p>

<h3>Reminders that fill the room</h3>
<p>Send confirmations and automated reminders as the date nears over <a href="/features/events/event-email-sms-marketing">email and SMS</a>, so the people who signed up actually show up. It's the difference between a full room and a quiet one, and it runs on its own once you set it.</p>

<h3>Regulars you can invite again</h3>
<p>Everyone who registers lands in your <a href="/features/events/attendee-crm">contact list</a> — a customer list you own, not one you rent. Announce your next event to the people who came to the last one and it fills faster, because you're inviting regulars instead of chasing strangers. That's how a one-off event becomes a repeat-customer engine.</p>

<h2>What changes</h2>
<p>Events stop feeling like a project and start feeling like a normal part of running the place. You can put one up on a Tuesday, it looks like your business, reminders keep the room full, and every event grows a customer list that makes the next one easier. The gathering does double duty — a good night now, and a reason to come back later.</p>

<blockquote>For local shops, restaurants, studios, and small businesses that want simple paid events and RSVPs, reminders that fill the room, and regulars they can invite back.</blockquote>

<p>See the fees on the <a href="/pricing">pricing page</a>, or put up your first event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Right-sized events that bring people back',
  'Simple paid events and RSVPs, reminders that fill the room, and a customer list you own.',
  'Start with Geiger Events',
  'Event & RSVP Software for Local Businesses | Geiger Events',
  'Set up paid events or free RSVPs in minutes, send reminders that fill the room, and turn attendees into repeat customers with a contact list you own.',
  array['small business events','local business rsvp','event registration for businesses','paid event tickets','customer event marketing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
