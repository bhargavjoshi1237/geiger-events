-- solution page: Partiful Alternative (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'The Partiful Alternative for Organizers Who Need Real Ticketing',
  'partiful-alternative',
  'Keep the social, low-friction energy of a great invite, and add real ticketing, capacity control, on-site check-in, and a CRM that actually remembers your guests.',
  $html$<p>The invite tool you use is genuinely fun. People RSVP by text without making an account, the guest list has visible energy, everyone drops photos in afterward, and it never feels like paperwork. That casual, social feel is a real strength — until the party grows into something you need to run. Now you want to cap the room before it overfills, sell a ticket instead of chasing a chip-in, know who actually walked in versus who just tapped "going," and remember the regulars so your next event isn't a cold start. The social magic is still there. The organizer tools underneath just aren't.</p>

<h2>Where a social invite tool stops short</h2>
<p>The gap shows up the moment money and scale enter. First, <strong>no real ticketing</strong> — casual payments and a guest-paid fee are fine for a chip-in, but not for tiers, timed sales, and add-ons. Second, <strong>loose capacity and check-in</strong> — an RSVP count isn't a door you can control, and a tap isn't a scan. Third, <strong>no memory</strong> — guests scatter after the event instead of becoming a list you can invite again. That easygoing energy is worth keeping. It just needs a real spine.</p>

<h2>An alternative that keeps the fun and adds the machinery</h2>
<p>Geiger Events is built so the social side stays social while the organizer side grows up — the same warm, shareable invite, now backed by tools that hold up when the event gets serious.</p>

<h3>The social energy, kept</h3>
<p>Your event still lives on a shareable page with real cover media, a custom URL, and a visible "who's going" list that creates the same momentum a great invite does — built in the <a href="/features/events/event-page-builder">visual page builder</a>. An <a href="/features/events/organizer-profiles-followers">organizer profile with followers</a> turns a one-off crowd into an audience that comes back, so the energy compounds instead of resetting after every party.</p>

<h3>Real ticketing, when you're ready to charge</h3>
<p>When a get-together becomes a ticketed event, <a href="/features/events/event-ticketing-payments">ticketing</a> is right there: multiple tiers, early-bird windows, discount codes, group orders, and add-ons — with free RSVPs and paid tickets running from the same flow. Payments run on Stripe, so checkout feels trustworthy to guests, and fees stay low and legible rather than guessed at (compare them on the <a href="/pricing">pricing page</a>).</p>

<h3>Capacity and check-in you can actually run</h3>
<p>Set a real capacity so the room can't oversell, then run the door with the <a href="/features/events/event-check-in-app">check-in app</a>: it scans QR tickets, works offline when the signal is weak, takes walk-up door sales, and shows live attendance. You'll know who's genuinely in the room, not just who tapped a button.</p>

<h3>A CRM that remembers your guests</h3>
<p>This is the piece a casual tool can't give you. Everyone who registers lands in your <a href="/features/events/attendee-crm">attendee CRM</a> as a contact you own — so the regulars, the big spenders, and the first-timers are all remembered. Your next event starts with a list, a reminder, and the followers who already love your parties, instead of a blank guest field.</p>

<h2>Growing up without getting boring</h2>
<p>The move doesn't cost you the vibe. Guests still get a fun, low-friction page and a lively guest list; you get capacity control, real tickets, a door that scans, and a memory that carries forward. The casual tool was perfect for the first few parties — it just wasn't built to help you run the tenth one, sell out the room, and turn a crowd into a following.</p>

<h2>What changes when the social tool grows a spine</h2>
<p>You keep the energy that made people show up and the shareable page that made it easy. You add ticketing for when you charge, capacity and check-in for when it's packed, and a CRM so the audience you build is yours to invite again. Fun was never the problem — the missing organizer tools were. This keeps the fun and hands you the controls.</p>

<blockquote>For hosts whose parties outgrew a casual invite tool and now need real ticketing, capacity, check-in, and a guest list that remembers.</blockquote>

<p>See the fees for yourself on the <a href="/pricing">pricing page</a>, or start building your next event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Keep the fun. Get the controls.',
  'The social, low-friction energy of a great invite, plus real ticketing, capacity, check-in, and a CRM that remembers your guests.',
  'Start with Geiger Events',
  'Partiful Alternative for Ticketed Events | Geiger Events',
  'A Partiful alternative for hosts who outgrew casual invites: keep the social energy and add real ticketing, capacity control, check-in, and a guest CRM.',
  array['partiful alternative','event invitation platform','event ticketing software','rsvp and ticketing','attendee crm'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
