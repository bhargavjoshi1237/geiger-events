-- solution page: Festival & Multi-Day Event Ticketing (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Festival & Multi-Day Event Ticketing',
  'festival-ticketing',
  'Sell tiers and bundles, scan thousands through multiple gates and zones, check in offline when the signal drops, and hold your capacity to the number — for festivals and multi-day events.',
  $html$<p>A festival is a hundred small operations pretending to be one event. Weekend passes, day tickets, camping add-ons, and VIP all have to sell without stepping on each other. Thousands of people arrive at once across several gates, and your scanners need to keep up when the field has no signal. And underneath it all is one number you cannot get wrong — capacity — because oversell it and you have a safety problem, undersell it and you left money on the table.</p>

<h2>Why multi-day events overwhelm normal tools</h2>
<p>Single-event ticketing buckles here. It can't cleanly model a weekend pass alongside single days and add-ons. It assumes one entrance, not a main gate plus camping plus a VIP zone. It falls over the moment the connection drops in a field. And it treats capacity as a soft cap instead of a hard limit you're accountable for. Every one of those gaps turns into a queue, a radio call, or a spreadsheet reconciliation at 2am.</p>

<h2>Ticketing that scales to a field</h2>
<p>Geiger Events is built for the shape of a multi-day event: layered tiers and bundles, many gates and zones, check-in that survives no signal, and capacity you actually control.</p>

<h3>Tiers, bundles, and passes</h3>
<p>Model weekend passes, day tickets, camping, and VIP as distinct tiers and bundles through <a href="/features/events/event-ticketing-payments">ticketing and payments</a>, powered by Stripe. Move early-bird into later pricing automatically, and layer <a href="/features/events/dynamic-ticket-pricing">dynamic pricing</a> so tiers step up as they sell. Fees are transparent and kept low across your whole run — the numbers are on the <a href="/pricing">pricing page</a>, not hidden in a per-ticket line.</p>

<h3>Many gates, many zones</h3>
<p>Scan thousands of arrivals across multiple entrances at once with the <a href="/features/events/event-check-in-app">check-in app</a> and multi-gate, multi-zone control — so a weekend pass opens the right areas and a day ticket doesn't. Staff on every gate see the same live picture instead of running separate lists.</p>

<h3>Offline when the field has no bars</h3>
<p>The check-in app works offline and syncs when it reconnects, so a dead zone at the back gate never stops the line. Scanning keeps working whether or not the signal does — the single most important thing a festival gate needs.</p>

<h3>Capacity you can defend</h3>
<p>Hold each ticket type and the overall event to a hard number, with real-time attendance updating as people flow through the gates. You always know how many are inside, per zone and overall, so capacity is a fact on a screen — not a guess on a radio.</p>

<h2>After the gates close</h2>
<p>Every attendee lands in your <a href="/features/events/attendee-crm">attendee CRM</a>, so next year's on-sale starts with a real audience instead of a cold post. Pull sales, attendance, and gate flow into <a href="/features/events/event-analytics">analytics and reporting</a> to see what sold, when, and where the pressure was — then plan the next edition on numbers, not memory.</p>

<h2>What changes</h2>
<p>The festival stops feeling like a stack of tools duct-taped together. Passes and add-ons sell without conflict, every gate reads from the same live count, offline stops being a crisis, and capacity is something you hold rather than hope for. The weekend runs on a system instead of on radios and adrenaline.</p>

<blockquote>For festivals and multi-day organizers who need layered tiers, multi-gate and zoned entry, offline check-in, and capacity control that holds under real crowds.</blockquote>

<p>See how the fees work across a full run on the <a href="/pricing">pricing page</a>, or start building your festival today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Ticketing that scales to a field',
  'Tiers and bundles, multi-gate and zoned entry, offline check-in, and capacity you actually control.',
  'Start with Geiger Events',
  'Festival & Multi-Day Event Ticketing | Geiger Events',
  'Sell festival tiers and bundles, scan thousands across multiple gates and zones, check in offline, and hold capacity to the number — with transparent fees.',
  array['festival ticketing','multi-day event ticketing','multi-gate check-in','offline event check-in','festival capacity management'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
