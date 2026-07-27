-- feature page: Reserved Seating (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Reserved Seating',
  'reserved-seating',
  'Let attendees pick their exact seat at checkout, with seats held while they pay and a seat map you control — for theaters, clubs, and banquet rooms, without an enterprise add-on.',
  $html$<p>Some events don't work with general admission. A theater show, a gala dinner, a club with tables, a concert with a real floor plan — the seat <em>is</em> the product, and "first come, first served at the door" turns into confusion and arguments. Reserved seating in Geiger Events lets buyers choose exactly where they'll sit while they check out, so the map you sell is the map that shows up on the night.</p>

<h2>Pick-your-seat at purchase</h2>
<p>Turn on reserved seating for a ticket type and buyers select their seat from your map during checkout instead of getting a generic ticket. They see what's open, choose what they want, and pay for that specific spot. No spreadsheet of seat assignments, no manual reshuffling afterward.</p>

<h3>Seats held while they pay</h3>
<p>When someone starts choosing a seat, it's held for a short window so two people can't buy the same chair at the same time. If they don't finish, the hold releases and the seat returns to the pool. That's the detail that keeps a busy on-sale from double-booking.</p>

<h3>A map you control</h3>
<p>Reserved seating is configured per event and tied to a named seat map, so a recurring venue can reuse the same layout each time. You decide which ticket types are seat-selectable and which stay general admission — a show can sell a reserved orchestra section and a standing-room tier side by side.</p>

<h2>Made for the rooms that need it</h2>
<p>Theaters and performing-arts venues, supper clubs and cabarets, award dinners and banquets, and any concert with an actual floor plan all run on assigned seats. Reserved seating gives those events the precision they need without pushing them toward an enterprise ticketing contract — it's part of the same <a href="/features/events/event-ticketing-payments">ticketing</a> system, at the same transparent fees. See how those fees work on the <a href="/pricing">pricing page</a>.</p>

<h2>Works with the rest of the flow</h2>
<p>A reserved seat is still a normal ticket: it carries a QR code, syncs to your <a href="/features/events/attendee-crm">attendee list</a>, and scans at the door through the <a href="/features/events/event-check-in-app">check-in app</a>. For high-demand shows, pair it with <a href="/features/events/anti-scalping-resale">anti-scalping rules</a> so seats can't be flipped by bots. The buyer picks a seat, pays, gets a pass, and walks in — one continuous flow.</p>

<h2>What changes for you</h2>
<p>You stop managing seating by hand. The floor sells itself in the exact configuration you set, holds prevent collisions, and the door already knows who belongs in which seat. The event feels considered because the seat plan was never an afterthought.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Sell the exact seat, not just a ticket',
  'Attendees pick their seat at checkout, seats are held while they pay, and you keep control of the map — no enterprise add-on.',
  'Start with Geiger Events',
  'Reserved Seating Ticketing for Events | Geiger Events',
  'Let attendees choose their exact seat at checkout with held seats and a seat map you control — for theaters, clubs, and banquets. No enterprise contract.',
  array['reserved seating ticketing','assigned seating events','pick your seat tickets','seating chart ticketing','theater ticketing software'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
