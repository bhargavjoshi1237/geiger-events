-- solution page: Conference & Summit Software (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Conference & Summit Event Software',
  'conference-event-software',
  'Plan the agenda, manage speakers and sponsors, register attendees at scale, print badges on-site, and run session check-in — all in one place instead of six.',
  $html$<p>A conference is a dozen events stacked into one, and every layer needs its own tooling. There's the multi-track agenda that changes weekly. The speakers who need bios collected, sessions assigned, and reminders sent. The sponsors expecting logo placement and lead capture. The hundreds or thousands of registrations flowing through tiers and discount codes. And the registration desk on day one, where a slow badge line becomes the first impression of the whole show. Most teams stitch this together from a registration tool, a spreadsheet for the agenda, an email chain with speakers, and a badge vendor who needs your data in their format by Tuesday.</p>

<h2>Where the conference stack falls apart</h2>
<p>The seams are where things break. Your registration numbers live in one system and your badge file in another, so the on-site list is always slightly stale. Speaker changes never make it to the printed program. Sponsors ask for a lead report you can only assemble by hand after the show. Every disconnect is manual reconciliation, and manual reconciliation at conference scale is where mistakes and long nights come from.</p>

<h2>One platform from call-for-papers to closing session</h2>
<p>Geiger Events keeps the whole conference in a single system, so the agenda, the people, the registrations, and the door all read from the same source of truth.</p>

<h3>Agenda and speakers that stay in sync</h3>
<p>Build a multi-track program with the <a href="/features/events/conference-agenda-speakers">agenda builder</a>, assign speakers to sessions, and collect submissions through a call-for-papers portal so proposals, bios, and headshots arrive structured instead of scattered across email. When a session moves, it moves everywhere — the public agenda, attendee schedules, and session check-in all update together.</p>

<h3>Sponsors and exhibitors, managed not chased</h3>
<p>Manage <a href="/features/events/sponsors-exhibitors">sponsors and exhibitors</a> with sponsorship packages, expo booths, and a floor plan, so every partner knows what they've bought and where they'll be. Exhibitors capture qualified contacts with <a href="/features/events/lead-retrieval">lead retrieval</a>, and you hand them a real report instead of a shoebox of business cards.</p>

<h3>Registration built for volume</h3>
<p>Sell passes at scale through proper <a href="/features/events/event-ticketing-payments">ticketing</a> — early-bird windows, tiered passes, group registration, access codes, and discount codes — with payments on Stripe and transparent, low fees detailed on the <a href="/pricing">pricing page</a>. Registration forms collect the dietary, accessibility, and session-preference details you'll actually need on-site.</p>

<h3>Badges and the registration desk</h3>
<p>On day one, print name badges on-site with <a href="/features/events/badge-printing">badge printing</a> that reads straight from your live registration data — no export, no vendor round-trip, no stale list. Attendees who register at the door get a badge the same way. The line moves, and the first thing people feel about your conference is that it's organized.</p>

<h3>Session check-in and attendance</h3>
<p>Scan attendees into individual sessions with the <a href="/features/events/event-check-in-app">check-in app</a> so you know real attendance per track, enforce room capacity, and give sponsors and speakers accurate numbers. It works offline when a packed ballroom kills the Wi-Fi, and shows live counts as rooms fill. For multi-day and recurring conferences, certificates and CEU credit can be issued off verified session attendance.</p>

<h2>What one system changes</h2>
<p>The registration desk runs off the same data as the marketing site. Speaker and agenda changes propagate instead of stranding a printed program. Sponsors get lead reports without you assembling them by hand. And you spend the weeks before the show refining the program instead of reconciling four tools that don't talk to each other. A conference has enough moving parts on its own — the software shouldn't add more.</p>

<blockquote>Built for conference, summit, and trade-event teams who want the agenda, speakers, sponsors, registration, badges, and session check-in reading from one source of truth.</blockquote>

<p>See how registration fees compare on the <a href="/pricing">pricing page</a>, or start planning your conference today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'The whole conference on one source of truth',
  'Agenda, speakers, sponsors, registration at scale, on-site badge printing, and session check-in — no more stitching six tools together.',
  'Start with Geiger Events',
  'Conference & Summit Event Software | Geiger Events',
  'Plan the agenda, manage speakers and sponsors, register attendees at scale, print badges on-site, and run session check-in — all in one conference platform.',
  array['conference event software','summit event platform','conference registration software','agenda builder','conference badge printing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
