-- solution page: Nightlife & Club Ticketing (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Nightlife & Club Ticketing',
  'nightlife-club-ticketing',
  'Sell tiers online, run the door without a line, keep tickets out of scalpers'' hands, and manage guest lists — all from one place built for club nights and promoters.',
  $html$<p>Promoting a night is a race against the clock. Tiers need to move in the right order, the door has to keep the line short when it matters most, and the guest list can't turn into a shouting match at the entrance. Meanwhile a chunk of your inventory ends up on resale profiles at triple the price, and the platform you're paying takes a cut you can't explain to your team. By the time the night starts, you've spent more energy on logistics than on the room.</p>

<h2>Where club nights get chaotic</h2>
<p>The pain is specific. Early-bird runs out and the next tier doesn't flip cleanly. Door sales pile up while one person hunts through a phone for names. Scalpers scoop the good tickets and your real crowd pays them, not you. And the guest list — comps, plus-ones, industry — lives in three group chats and a screenshot. Every one of those is a line at the door and a hit to the vibe.</p>

<h2>Built for the tempo of a night</h2>
<p>Geiger Events handles the parts of nightlife that break under pressure: tiered ticketing that moves in order, a fast door, controls that keep tickets with real fans, and a check-in flow that keeps the entrance moving.</p>

<h3>Tiers that sell in order</h3>
<p>Set up early-bird, GA, and later tiers with <a href="/features/events/event-ticketing-payments">ticketing and payments</a> powered by Stripe, so each price flips to the next as inventory sells — no manual switching at midnight. Add <a href="/features/events/discount-codes-promo">codes</a> for your promoters and lists. Fees are transparent and kept low so more of the door is yours; the numbers are on the <a href="/pricing">pricing page</a>, not hidden in checkout.</p>

<h3>Keep tickets with real fans</h3>
<p>Use <a href="/features/events/anti-scalping-resale">anti-scalping and controlled resale</a> so tickets don't disappear onto profit-driven resale profiles the minute they sell. Your crowd pays face value, and the value stays with the night instead of a scalper.</p>

<h3>A door that keeps the line short</h3>
<p>On the night, the <a href="/features/events/event-check-in-app">check-in app</a> scans QR tickets in a beat and works offline when the venue signal drops — so the entrance keeps moving even when the room is packed. Sell walk-ups at the door and take payment on the spot, and search a name in seconds when someone shows up without their ticket. Every scan updates a live headcount so you know your numbers as the room fills.</p>

<h3>Guest lists that aren't a group chat</h3>
<p>Comps, plus-ones, industry, and press live in one <a href="/features/events/attendee-crm">guest and contact list</a> instead of scattered screenshots. Everyone who buys or gets added is saved, so your regulars and VIPs are already there for the next night — a real audience you can invite back instead of rebuilding every week.</p>

<h2>The morning after does the work too</h2>
<p>The people who came are already in your CRM, ready for the next announcement. Message them the moment the next date drops over <a href="/features/events/event-email-sms-marketing">email and SMS</a>, and the first tier is half-sold before you've even posted.</p>

<h2>What changes</h2>
<p>The night stops fighting you. Tiers sell themselves in order, the door stays short, scalpers stop skimming your crowd, and the guest list is one clean list instead of five chats. You get to run the room, not the spreadsheet — and every night builds the audience for the next one.</p>

<blockquote>For clubs, promoters, and nightlife organizers who want fast tiers, a short door, scalper-proof tickets, and guest lists that finally live in one place.</blockquote>

<p>See how the fees compare on the <a href="/pricing">pricing page</a>, or set up your next night today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Ticketing built for the tempo of a night',
  'Tiers that sell in order, a door without a line, scalper-proof tickets, and guest lists in one place.',
  'Start with Geiger Events',
  'Nightlife & Club Ticketing Software | Geiger Events',
  'Sell tiered tickets online, run fast door sales, block scalpers, and manage guest lists for club nights — with transparent, lower fees.',
  array['nightlife ticketing','club ticketing software','event door sales','anti-scalping tickets','guest list management'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
