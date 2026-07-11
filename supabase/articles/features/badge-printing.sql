-- feature page: On-site Badge Printing (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'On-site Badge Printing',
  'badge-printing',
  'Design attendee badges, pick a template, and print one for every registrant right at check-in — part of the Geiger Events on-site suite.',
  $html$<p>At a conference, an expo, or any event where people need to find each other, the badge is the handshake. It tells a room who someone is before they say a word. Geiger Events builds badge printing into check-in, so you design the badge once and print it for every attendee on the day — no separate design tool, no exported spreadsheet handed to a print vendor, no reconciling two lists.</p>

<h2>Design the badge, then print the room</h2>
<p>Start from a template — a classic full badge, a compact strip, a QR-forward layout, or a VIP style — then fine-tune what appears on it. Toggle the attendee's name, their company or role, a ticket code, and a QR code on or off, add an event-name header, and set an accent color for the band across the top. A live preview shows exactly what will come out of the printer, using real attendee data, so what you see is what prints.</p>

<h3>Pulled from your real attendee list</h3>
<p>Badges aren't typed by hand. Pick one of your upcoming events and the badge sheet is built from the people actually registered for it, straight from your <a href="/features/events/attendee-crm">attendee records</a>. Print the whole set as a sheet or a PDF, and every badge carries that attendee's name, company, and code with no manual entry. Need the underlying data for a third-party printer or a check? Export it as a CSV in a click.</p>

<h2>Printed at the door, not weeks ahead</h2>
<p>Pre-printing badges means guessing your final headcount and eating the waste when plans change. On-site printing flips that: because the badge sheet reads your live list, walk-ups and last-minute registrations get a badge too, and no-shows don't leave a pile of unused cards. The same event that admits attendees through <a href="/features/events/event-check-in-app">check-in</a> can hand them a badge in the same moment.</p>

<h3>One preset per audience</h3>
<p>A speaker badge, a sponsor badge, and a general-admission badge often need to look different. Because layout is driven by simple toggles and a template, you can produce distinct looks without redesigning from scratch — turn the company line on for exhibitors, lead with the QR for scannable networking, or strip a VIP badge down to just the name.</p>

<h2>Part of a complete on-site suite</h2>
<p>Badge printing is one piece of how Geiger handles the door. It sits alongside QR tickets, wallet passes, the check-in app, and name-search lookup, all reading the same attendee list, so a person can be admitted, printed, and counted in a single pass. For expos where exhibitors need to capture who they met, that scannable badge also feeds lead retrieval — the QR on the badge is the same code a booth scans.</p>

<p>Everything you print is tied to a real registration, so the badge always reflects the attendee's actual ticket type and details. See how the full on-site toolkit fits together on the <a href="/features/events/event-check-in-app">check-in page</a>, and what's included per plan on the <a href="/pricing">pricing page</a>.</p>

<h2>Why it matters</h2>
<p>Badges are one of those on-site jobs that quietly consume a morning if the tooling is wrong — mismatched lists, a printer that won't talk to your spreadsheet, a stack of badges for people who never showed. Building printing on top of your live attendee data removes the reconciliation entirely: the list is the list, the design is set, and the printer just runs.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Badges printed straight from your attendee list',
  'Design attendee badges, choose a template, and print one for every registrant at check-in.',
  'Start with Geiger Events',
  'On-site Event Badge Printing | Geiger Events',
  'Design attendee badges from templates and print one for every registrant at check-in, pulled straight from your live attendee list. No exports, no reconciliation.',
  array['event badge printing','attendee badges','on-site badge printing','conference name badges','print badges at check-in'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
