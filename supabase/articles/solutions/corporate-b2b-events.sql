-- solution page: Corporate & B2B Events (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Corporate & B2B Event Software',
  'corporate-b2b-events',
  'Run field-marketing events on-brand and on-process — registration, team roles, on-site check-in, analytics, and an API to push attendance straight into your CRM and marketing stack.',
  $html$<p>Corporate and B2B events carry expectations a consumer ticket link never has to meet. The event page has to look like it came from your brand, not a generic marketplace. Multiple people on the team need access, but not all the same access. The data can't die in the platform — it has to flow into your CRM and marketing automation so sales can follow up and marketing can attribute pipeline. And when leadership asks what the event returned, "we sold some tickets" is not an answer. Field-marketing teams end up bolting a consumer event tool onto their real systems with a spreadsheet and a prayer.</p>

<h2>Where consumer event tools fail a B2B team</h2>
<p>The gaps are structural. The pages are branded for the platform, not for you. There's one login for a whole team, so access is all-or-nothing. And the data is a walled garden — you can export a CSV, but there's no clean, ongoing path into your CRM or data warehouse, which means attendance never becomes pipeline without manual re-keying. For a team measured on sourced and influenced revenue, that last gap is the whole game.</p>

<h2>Built to fit into a company, not around one event</h2>
<p>Geiger Events gives field-marketing and corporate teams the branding, controls, and data plumbing that make an event part of the go-to-market motion instead of a detour from it.</p>

<h3>On-brand pages and registration</h3>
<p>Build registration pages that look like your company with the <a href="/features/events/event-page-builder">event page builder</a> — your look, your custom URL, your content — and collect exactly the qualifying details you need through structured registration and <a href="/features/events/event-ticketing-payments">ticketing</a>. Free RSVP events, paid summits, and invite-only executive roundtables all run from the same flow, on Stripe payments with transparent low fees detailed on the <a href="/pricing">pricing page</a>.</p>

<h3>Team roles and controlled access</h3>
<p>A real team needs real permissions. Assign team members roles so the person running the door doesn't have billing access and the agency partner sees only what they should. Everyone works in the same workspace with the access appropriate to their job, instead of sharing one password.</p>

<h3>Check-in and reliable attendance data</h3>
<p>On-site, the <a href="/features/events/event-check-in-app">check-in app</a> scans attendees in, works offline when venue Wi-Fi fails, and shows live attendance — so your attended-versus-registered numbers are accurate, not estimated. That distinction matters when attendance is the metric that becomes a lead score.</p>

<h3>Analytics and an API that feeds your stack</h3>
<p>Track registration, attendance, and channel performance in built-in analytics, then push it where it belongs: the <a href="/features/events/api-webhooks">API and webhooks</a> let registrations and check-ins flow into your CRM and marketing automation in near real time, so sales gets fresh lists and marketing can attribute the event to pipeline without manual exports. Every attendee also lands in the <a href="/features/events/attendee-crm">attendee CRM</a> as a segmentable record you can carry into the next campaign or the next event.</p>

<h2>What changes when the event fits your systems</h2>
<p>Pages carry your brand instead of a platform's. Access matches roles instead of being all-or-nothing. And attendance data becomes CRM records and pipeline attribution automatically instead of a CSV someone re-keys at midnight. The event stops being a silo bolted onto your go-to-market stack and becomes a native part of it — which is the only way a field-marketing program scales past a handful of events a year.</p>

<blockquote>Built for corporate and B2B field-marketing teams who need branded pages, team roles, reliable check-in, and an API that turns attendance into CRM pipeline.</blockquote>

<p>See how pricing works on the <a href="/pricing">pricing page</a>, or start building your next field event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'An event that fits your stack, not the other way around',
  'Branded registration, team roles, reliable check-in, analytics, and an API that pushes attendance straight into your CRM and marketing automation.',
  'Start with Geiger Events',
  'Corporate & B2B Event Software | Geiger Events',
  'Run field-marketing events on-brand with team roles, on-site check-in, analytics, and an API that turns attendance into CRM pipeline. Built for B2B teams.',
  array['corporate event software','b2b event platform','field marketing events','event management for teams','event api integration'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
