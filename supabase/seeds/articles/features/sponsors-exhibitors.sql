-- feature page: Sponsors & Exhibitors (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Sponsors & Exhibitors',
  'sponsors-exhibitors',
  'Manage sponsors and their tiers, sell reusable sponsorship packages, assign expo booths, capture exhibitor leads, and report sponsor ROI — the commercial side of your event in one place.',
  $html$<p>Sponsors and exhibitors fund the event, but they're usually managed in a mess of spreadsheets, slide decks, and email threads. Who's confirmed at which tier? Which booths are still open? Did the exhibitor actually get the leads they paid for? Geiger Events pulls the whole commercial side of your event into one workspace, so you can sell packages, assign the floor, capture leads, and show sponsors what they got.</p>

<h2>Sponsors and their tiers</h2>
<p>Every sponsor gets a record with their tier, committed amount, primary contact, website, logo, and the specific benefits they receive. Track each one through its own pipeline — from prospect to confirmed — so you always know what's signed versus still in conversation. The stats bar rolls up how many sponsors are confirmed, total sponsorship committed, and how many sit at your top tier, which turns "how's sponsorship going?" into a number you can answer instantly.</p>

<h3>Reusable sponsorship packages</h3>
<p>Instead of describing what a Gold sponsorship includes over and over, build it once. Sponsorship packages are reusable tiers with a price, a set number of available slots, and the benefits each one carries. Track slots sold against slots available so you know when a tier is nearly gone, and see the total value of your inventory if everything sells. For how pricing and fees work across the platform, see the <a href="/pricing">pricing page</a>.</p>

<h2>Assign the expo floor</h2>
<p>Expo booths give you the exhibitor floor as a set of records — each booth with its hall or zone, size, assigned exhibitor, and price. Move a booth from available to occupied as it's booked, filter by size, and see occupancy and revenue from occupied booths at a glance. When you're laying out the physical space, booths connect to your floor plans so the map and the roster describe the same room.</p>

<h3>Sponsor rooms and expo presence</h3>
<p>Beyond the physical floor, sponsors and exhibitors can host their own space at the event — a place to meet attendees, share materials, and run their presence. These sponsor-facing rooms are part of the virtual and hybrid experience; see how they fit alongside session streaming on our <a href="/solutions/events/virtual-hybrid-events">virtual and hybrid events</a> page.</p>

<h2>Capture the leads exhibitors came for</h2>
<p>The whole reason a company exhibits is to leave with leads. <a href="/features/events/lead-retrieval">Lead retrieval</a> lets exhibitors capture attendee contacts on the floor — scanning a badge to save who they talked to — instead of collecting business cards in a fishbowl. Those captured contacts become a clean, exportable list the exhibitor can actually follow up on, which is what makes them want to come back next year.</p>

<p>Because lead capture runs through the same check-in and badge system as the rest of the event, exhibitors scan the same <a href="/features/events/badge-printing">printed badges</a> attendees already wear — no separate app for attendees to install, no duplicate data to reconcile.</p>

<h2>Show sponsors their return</h2>
<p>A renewed sponsor is worth more than a new one, and renewals come from proof. Sponsor ROI reporting brings sponsorship into your <a href="/features/events/event-analytics">analytics and reporting</a>, so instead of a vague "it went great," you can show a sponsor concrete numbers — the exposure and engagement tied to their investment. That's the difference between a hopeful renewal email and a data-backed conversation.</p>

<h2>The commercial side, in one workspace</h2>
<p>Sponsors, packages, booths, leads, and ROI all read from the same records, so the money side of your event stops living in scattered files. Sell a package, assign a booth, hand the exhibitor a lead scanner, and report the results — without switching tools between each step. It sits right next to your <a href="/features/events/conference-agenda-speakers">agenda and speakers</a> as part of a complete conference, and scales from a single sponsored meetup to a full trade show floor.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Sell sponsorships, fill the floor, prove the return',
  'Manage sponsor tiers, sell reusable packages, assign expo booths, capture exhibitor leads, and report sponsor ROI — the whole commercial side in one place.',
  'Start with Geiger Events',
  'Sponsor & Exhibitor Management Software | Geiger Events',
  'Manage sponsors and tiers, sell sponsorship packages, assign expo booths, capture exhibitor leads, and report sponsor ROI — all in one event workspace.',
  array['sponsor and exhibitor management','sponsorship management software','expo booth management','exhibitor lead capture','sponsor roi'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
