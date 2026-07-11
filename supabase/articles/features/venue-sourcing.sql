-- feature page: Venue & Supplier Sourcing (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Venue & Supplier Sourcing',
  'venue-sourcing',
  'Send smart custom proposals, book available spaces instantly, and put your venue in front of organizers who are actively looking — sourcing that fits how events actually get booked.',
  $html$<p>Finding and booking a space is still one of the slowest parts of putting on an event. Requests go out over email, proposals come back in a dozen formats, and by the time you've compared them the good dates are gone. Sourcing brings the back-and-forth into one place, for both the organizers looking for a room and the venues that want to be found.</p>

<h2>Smart custom proposals</h2>
<p>Instead of freeform email threads, sourcing runs on structured proposals — the space, the dates, what's included, the terms — so organizers can actually compare options side by side and venues can respond consistently. Less chasing, fewer misread quotes, faster to a yes.</p>

<h2>Instant book</h2>
<p>For spaces with clear availability, instant book skips the negotiation entirely: an organizer sees the space is open and books it then and there. It's the difference between a week of emails and a confirmed room in a single sitting.</p>

<h2>Advertising</h2>
<p>Venues can advertise to put their space in front of organizers at the moment they're searching. Rather than waiting to be found, a venue reaches the people who are actively planning an event that fits — demand and supply meeting where the decision is being made.</p>

<h2>Part of the bigger event picture</h2>
<p>Sourcing connects to the rest of how you run an event. A booked space flows into your <a href="/features/events/venue-management">venue records</a> so its location fills into the event automatically, and into <a href="/features/events/event-floor-plans-seating">floor plans</a> when it's time to lay out the room. For conferences that also need rooms and travel handled, this sits alongside the housing and travel tools in the conference toolkit.</p>

<h2>What changes for you</h2>
<p>Booking a space stops being a bottleneck. Organizers compare real proposals instead of inbox chaos, take available rooms instantly, and move on to planning; venues get discovered by the right organizers instead of waiting on referrals. See how sourcing fits your plan on the <a href="/pricing">pricing page</a>.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Source and book your space without the email maze',
  'Smart custom proposals, instant booking for open spaces, and advertising that connects venues with organizers who are actively looking.',
  'Start with Geiger Events',
  'Venue & Supplier Sourcing for Events | Geiger Events',
  'Send smart custom proposals, instantly book available spaces, and reach organizers who are actively searching. Event venue sourcing that fits how bookings happen.',
  array['venue sourcing','event venue booking','venue proposals','instant book venue','event supplier sourcing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
