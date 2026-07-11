-- feature page: Organizer Profiles & Followers (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Organizer Profiles & Followers',
  'organizer-profiles-followers',
  'A public organizer profile people can follow, so your next event reaches an audience that already opted in — plus social proof that helps buyers decide.',
  $html$<p>Most event tools treat every event as a cold start: you announce it, buy attention, and hope enough of the right people see it in time. But the people most likely to come to your next event are the ones who came to your last. An organizer profile with followers turns that repeat audience into an asset you own — a public identity people can follow, and a list that hears about every new event you put on.</p>

<h2>A profile that represents you</h2>
<p>Your organizer profile is the public face buyers see and choose to follow. Give it a display name, a tagline, and a bio that says who you are and what you host; add a website, a location, a public contact email, and links to your social channels. It renders on your public events page, so an attendee who liked one event can find the identity behind it — and follow it.</p>

<h3>Followers, not just one-time buyers</h3>
<p>When someone follows your profile, they're opting in to hear about what you do next. That's the difference between a buyer who disappears after checkout and an audience you can reach directly. As people follow, they collect on your followers list, where you can see your total, watch recent growth, and export the whole list as a CSV to use wherever you need it.</p>

<h2>Your next event reaches a warm audience</h2>
<p>The payoff of followers is distribution you don't have to rebuy. When you announce a new event, your followers are the audience that's already raised their hand — no ad spend required to reach the people most inclined to come. Followers are notified about new events, so the launch that used to start from silence starts from a base of interested people instead.</p>

<h3>Pair it with a Follow button</h3>
<p>The way you grow that base is by making it easy to opt in — a Follow button on your public events page turns a satisfied attendee into a follower in one click. Every event you run becomes a chance to convert first-time buyers into a standing audience for the next one.</p>

<h2>Social proof that helps buyers decide</h2>
<p>A profile does more than collect followers — it reassures the people deciding whether to buy. A filled-out organizer identity signals a real, established host rather than an anonymous listing, and that credibility lowers the hesitation between interest and purchase. Combined with signals of who's going, your profile gives a wavering buyer reasons to commit.</p>

<h2>Connected to the rest of your audience</h2>
<p>Followers aren't a separate silo. They're part of the same audience data as your attendees in the <a href="/features/events/attendee-crm">attendee CRM</a>, so the people who follow you and the people who buy from you build one picture of your community. Turn a purchase into a follow, a follow into a member with memberships, or announce to your followers through an <a href="/features/events/event-automation">automated workflow</a> — the follower list is a foundation the rest of the platform builds on.</p>

<p>To see how followers connect to selling and running your events, start with the <a href="/features/events/event-ticketing-payments">ticketing page</a>, and check what's included on each plan on the <a href="/pricing">pricing page</a>.</p>

<h2>Why it matters</h2>
<p>Renting attention for every event is expensive and fragile; owning an audience is neither. A profile people follow compounds over time — each event adds followers, and each follower makes the next event easier to fill. That's the quiet advantage of building a base instead of a series of cold launches: your reach grows with you.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Build an audience that follows you',
  'A public organizer profile people can follow, so your next event reaches an audience that already opted in.',
  'Start with Geiger Events',
  'Follow Event Organizers & Organizer Profiles | Geiger Events',
  'Give buyers a public organizer profile to follow, notify followers of every new event, and turn one-time attendees into a standing audience — with built-in social proof.',
  array['follow event organizers','organizer profile','event followers','build an event audience','organizer page'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
