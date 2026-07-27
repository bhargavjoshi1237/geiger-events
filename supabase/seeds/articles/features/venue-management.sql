-- feature page: Venue Management (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Venue Management',
  'venue-management',
  'Keep every place you host as a reusable venue record — location, capacity, amenities, and contacts in one place — and pick it when creating an event to fill everything in.',
  $html$<p>If you host at the same handful of places, you shouldn''t be re-typing the address, the capacity, and the parking notes for every event. Venue management turns each place you use into a reusable record you maintain once and pick from forever. Create the venue, keep it current, and every event you hold there fills in from it automatically.</p>

<h2>A record for every place you host</h2>
<p>A venue holds everything you need to know about a location: its name and type, the full address and city, its timezone, and map coordinates. It carries seated and standing capacity, the number of spaces, and a list of amenities, plus practical notes on parking and transit. Add contacts — a name, email, and phone for whoever runs the room — and a cover photo and gallery so the space is instantly recognizable. It is the single source of truth for a place, not a field you retype into each event.</p>

<h3>Organized and searchable</h3>
<p>Your venues live in one workspace, filterable by status and type and searchable by name, city, or address. At a glance you can see how many venues you keep, their combined capacity, how many are active and bookable now, and how many distinct cities you operate in — useful when your calendar spans more than one place.</p>

<h2>Pick a venue, fill in the event</h2>
<p>The real payoff is at event-creation time. Choose a saved venue and its location flows straight into the event — no re-typing the address, no transposed postcode, no wondering which "The Glasshouse" you meant. The details you maintained once populate every event held there, so your listings stay accurate and consistent without manual effort.</p>

<h3>Shown on the public page</h3>
<p>A venue isn''t just internal bookkeeping. The location you saved surfaces on the public <a href="/features/events/event-page-builder">event page</a> and across your <a href="/features/events/organizer-event-page">Event Wall</a> — the venue name and city on every card — so attendees always know exactly where to show up. Update a venue record and the change reflects wherever that venue appears.</p>

<h2>Maintain once, reuse everywhere</h2>
<p>Venues are living records. Edit one to correct a detail or refresh a photo, duplicate a close match as the basis for a similar space, and know that events already linked to a venue keep their saved address even if the venue itself changes — so history stays intact. When a venue''s parking changes or a contact moves on, you fix it in one place and every future event benefits.</p>

<h2>Where venues fit</h2>
<p>Venue records are the foundation the on-site tools build on. For laying out the room itself — tables, stages, and seating to scale — see <a href="/features/events/event-floor-plans-seating">floor plans and seating charts</a>, and for finding a new space when your usual ones won''t do, <a href="/features/events/venue-sourcing">venue sourcing</a> covers proposals and instant booking. Together they take a venue from a name in a list to a fully planned space.</p>

<p>For any organizer who returns to the same rooms — a promoter with a circuit, a community with a regular hall, a business with a set of offices — venue management removes a whole category of repetitive, error-prone data entry. Build your library of places once, and every event you create there starts already knowing where it is. Venue records come standard; see the <a href="/pricing">pricing page</a> for how plans work.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Your venues, saved once and reused',
  'Keep every place you host as a reusable record — location, capacity, amenities, contacts — and pick it when creating an event to fill everything in.',
  'Start with Geiger Events',
  'Venue Management Software | Geiger Events',
  'Manage reusable venue records with location, capacity, amenities, and contacts. Pick a saved venue when creating an event to fill everything in automatically.',
  array['venue management software','venue database','reusable venue records','event venue directory','manage event locations'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
