-- solution page: Luma Alternative (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'The Luma Alternative for Organizers Who Sell Tickets',
  'luma-alternative',
  'Keep the clean pages and community feel you like, and add deeper ticketing, real on-site check-in operations, and transparent, lower fees — for organizers who have outgrown a lightweight tool.',
  $html$<p>You started with a tool that made a beautiful event page in about a minute, and for a while that was exactly right — calendars, reminders, a following that came back each month. Then the events got bigger. You wanted a tier for early birds and a higher one for the door. You wanted to hold a block of seats, stop resellers from flipping the good ones, and run a check-in line that didn't stall when the venue Wi-Fi dropped. And on paid events, the platform fee started to feel like a tax on the growth you'd built. The page still looks great. The machinery underneath just isn't keeping up.</p>

<h2>Where a lightweight community tool runs out of room</h2>
<p>The frustration is specific. First, <strong>shallow ticketing</strong> — a paid ticket and an RSVP, but not the tiers, timed windows, add-ons, and controlled resale a real paid event needs. Second, <strong>thin door operations</strong> — check-in that works until the line is long and the signal is weak. Third, <strong>a platform fee on paid events</strong> that quietly scales with your success. None of this means the tool was wrong to start with. It means you've outgrown it.</p>

<h2>An alternative that keeps the good parts</h2>
<p>Geiger Events is built for the organizer who loves the modern, community-first experience but now needs the depth underneath it — without giving up the page that made people show up in the first place.</p>

<h3>The clean page and community feel, kept</h3>
<p>Build an event page with real cover media, a rich description, and a custom URL in the <a href="/features/events/event-page-builder">visual page builder</a>. An <a href="/features/events/organizer-profiles-followers">organizer profile with followers</a> means the audience you grow carries from one date to the next, and a "who's going" list adds the social proof that fills a room. If you run a monthly meetup or a recurring series, that following is the engine — and it stays yours.</p>

<h3>Ticketing with real depth</h3>
<p>This is where the upgrade shows. <a href="/features/events/event-ticketing-payments">Ticketing</a> handles multiple tiers, early-bird timed windows, discount codes, group orders, and add-ons from one flow. For seated rooms you can hold and assign specific seats, and controls that discourage scalping and reselling keep the good inventory in real fans' hands. Free RSVPs and paid tickets live in the same place, so charging money doesn't mean bolting on a second product.</p>

<h3>On-site operations that hold up</h3>
<p>The <a href="/features/events/event-check-in-app">check-in app</a> scans QR tickets, keeps working offline when venue Wi-Fi drops, supports door sales for walk-ups, and shows live attendance as people arrive. It's the difference between a smooth entrance and a bottleneck at the one moment your attendees judge the whole event.</p>

<h3>Transparent, lower fees</h3>
<p>Many community tools charge a platform fee on paid events, often reduced only if you move up to a monthly plan. We keep fees low and state them plainly instead of publishing a number here that could go stale — the current specifics live on the <a href="/pricing">pricing page</a>, and it's worth comparing them directly against the platform fee you pay today. Payments run on Stripe, the same trusted checkout rails, so lower cost doesn't mean a rougher buying experience for your guests.</p>

<h2>Moving over without losing momentum</h2>
<p>The switch is gentle because the fundamentals are familiar — make a page, share it, welcome your followers, scan people in. What changes is the ceiling. Everyone who registers lands in your <a href="/features/events/attendee-crm">attendee CRM</a> as a contact you own, so segmentation, reminders, and the invite for your next date all draw from a list that belongs to you. For a recurring organizer, reusable setup and a growing follower base mean each new event launches faster than the last.</p>

<h2>What you gain by leveling up the stack</h2>
<p>You keep the modern page and the community energy that made the lightweight tool feel good. You add ticketing deep enough for serious paid events, door operations that don't buckle under a real crowd, and fees that stay legible as you grow. The clean starting point was never the problem — the low ceiling was. This raises it without asking you to trade away the parts you liked.</p>

<blockquote>For organizers who love a modern, community-first event tool but have outgrown its ticketing, check-in, and platform fees.</blockquote>

<p>Compare the fees for yourself on the <a href="/pricing">pricing page</a>, or start building your next event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Keep the clean pages. Add the depth.',
  'The modern community feel you like, plus deeper ticketing, real on-site check-in, and transparent, lower fees — for organizers who sell tickets.',
  'Start with Geiger Events',
  'Luma Alternative for Ticketed Events | Geiger Events',
  'A Luma alternative for organizers who sell tickets: keep clean, community-first pages and add deep ticketing, real check-in ops, and transparent, lower fees.',
  array['luma alternative','community event platform','event ticketing software','sell tickets online','event check-in app'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
