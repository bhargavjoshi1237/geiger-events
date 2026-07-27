-- feature page: Floor Plans, Seating Charts & Diagramming (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Floor Plans, Seating Charts & Diagramming',
  'event-floor-plans-seating',
  'Design to-scale floor plans, drop in tables and objects from a library, build seating charts, check setup-style capacity, and share the diagram with your venue and team.',
  $html$<p>Laying out a room is where a lot of events quietly go wrong. A sketch on paper doesn't tell you whether the tables actually fit, the caterer and the venue are working from different versions, and the seating plan lives in someone's head until the day-of. Event Design gives you a real, to-scale plan of the space and the tools to fill it deliberately.</p>

<h2>To-scale floor plans</h2>
<p>Build the room to scale so what you draw is what will physically fit. Walls, dimensions, and clearances are real, which means the layout you approve is one you can actually set up — no surprises when the tables arrive.</p>

<h3>An object library</h3>
<p>Drop in rounds, banquet tables, a stage, a bar, a dance floor, and the rest of the furniture from an object library instead of drawing each piece. Arrange the room by moving real objects around a real plan.</p>

<h2>Seating charts</h2>
<p>Turn the layout into a seating chart — assign tables and seats, group guests, and keep the plan tied to the actual room rather than a separate spreadsheet. For ticketed shows, this connects to <a href="/features/events/reserved-seating">reserved seating</a> so the seats you plan are the seats you sell.</p>

<h2>Setup styles and capacity checks</h2>
<p>Switch between setup styles — banquet, theater, classroom, reception — and see how each changes the capacity of the space. Instead of guessing whether a room holds your headcount, you check it against a to-scale plan for the exact configuration you're running.</p>

<h2>Share it, walk it, reuse it</h2>
<p>Share the diagram with your venue, caterer, and team so everyone works from one version. Reuse a layout as a room template for the next event in the same space, and build up a library of the venues you work in. For events that also need to source a space, this pairs with <a href="/features/events/venue-sourcing">venue sourcing</a> and your <a href="/features/events/venue-management">venue records</a>.</p>

<h2>What changes for you</h2>
<p>The room stops being a guess. You know it fits before you commit, everyone sets up from the same plan, seating is decided in advance, and each event in a space starts from the last one instead of a blank page. See how Event Design fits your plan on the <a href="/pricing">pricing page</a>.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Design the room before you fill it',
  'To-scale floor plans, an object library, seating charts, setup-style capacity checks, and diagrams you share with your venue and team.',
  'Start with Geiger Events',
  'Event Floor Plan & Seating Chart Software | Geiger Events',
  'Design to-scale event floor plans, build seating charts, check setup-style capacity, and share diagrams with your venue and team — all in one place.',
  array['event floor plan software','event diagramming','seating chart software','banquet table layout','event capacity planning'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
