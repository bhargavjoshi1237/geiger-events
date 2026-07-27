-- solution page: Events for Independent Creators (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Events for Independent Creators',
  'creator-events',
  'Sell out your workshops, drops, and nights with a page people actually want to share, ticketing that keeps more of the money, and a following that shows up for the next one.',
  $html$<p>You built an audience one post at a time, and now you want to bring them into a room — a workshop, a listening session, a paid drop, a late-night thing. But the tools for that feel like they were made for someone else. A generic ticketing site slaps its own brand on your event and skims a chunk you can't explain to anyone. A free RSVP link looks like a spreadsheet and forgets your people the moment the night ends. And nothing you use connects the event back to the audience you already have.</p>

<h2>The gap between having a following and filling a room</h2>
<p>The problem isn't reach — you have that. It's that every event starts from scratch. The people who came to the last thing aren't saved anywhere useful, so you re-announce to the void and hope. The checkout page looks nothing like the rest of your work, so the momentum you built dies at the payment step. And when you finally do sell tickets, the fees are a black box that eats into work you priced carefully.</p>

<h2>A setup that looks like you and pays like it should</h2>
<p>Geiger Events gives independent creators a page worth sharing, ticketing that keeps more of the money in your pocket, and an audience that compounds instead of resetting after every event.</p>

<h3>A page that matches your work</h3>
<p>Build an event page with your own cover media, a real description, location and time, and a clean custom URL using the <a href="/features/events/event-page-builder">visual page builder</a>. It looks like something you made, not a form you filled out — so sharing it feels on-brand instead of off. Run the same drop again and again? Save it as a <a href="/features/events/event-templates">template</a> so the next launch takes minutes.</p>

<h3>Ticketing that respects the price you set</h3>
<p>Sell tickets — general admission, early-bird tiers, limited drops — through proper <a href="/features/events/event-ticketing-payments">ticketing and payments</a>, powered by Stripe so money lands where it should. Fees are transparent and kept low, which matters when you're the one who priced the work; the real numbers live on the <a href="/pricing">pricing page</a> instead of buried in a checkout. Add <a href="/features/events/discount-codes-promo">discount codes</a> for your close circle, collaborators, or an early list.</p>

<h3>An audience that carries to the next event</h3>
<p>An <a href="/features/events/organizer-profiles-followers">organizer profile</a> lets people follow you, so the audience you build at one event is already there for the next. Everyone who buys or RSVPs lands in your <a href="/features/events/attendee-crm">attendee CRM</a> — a real contact list you own, ready to invite again, segment, or reward. You stop renting your audience from an algorithm every single time.</p>

<h3>Reminders that cut the no-shows</h3>
<p>Announce the next thing, follow up with people who almost bought, and send day-of reminders over <a href="/features/events/event-email-sms-marketing">email and SMS</a> — so the room is as full as the sales page said it would be.</p>

<h2>The door, without the awkwardness</h2>
<p>On the night, scan QR tickets from your phone with the <a href="/features/events/event-check-in-app">check-in app</a>. It works offline when the venue Wi-Fi doesn't, so there's no fumbling at the entrance and no printed list — just a quick scan and a real count of who's actually in.</p>

<h2>What changes</h2>
<p>Your events stop feeling like a side quest bolted onto your work and start feeling like part of it. The page looks like you, the money makes sense, and the people who show up become an audience you can invite back — instead of strangers you have to find again next time.</p>

<blockquote>For creators who want beautiful pages, ticketing that keeps more of the money, and a following that shows up again — without enterprise pricing or someone else's brand on your night.</blockquote>

<p>Compare the fees on the <a href="/pricing">pricing page</a>, or build your first event page today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'The events setup that looks like you and pays like it should',
  'Beautiful pages, low-fee ticketing, and a following that shows up for the next drop, workshop, or night.',
  'Start with Geiger Events',
  'Event Ticketing for Independent Creators | Geiger Events',
  'Sell workshops, drops, and nights with a shareable page, low-fee ticketing powered by Stripe, and a following that comes back for the next event.',
  array['event ticketing for creators','sell tickets online','creator events','workshop ticketing','low fee ticketing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
