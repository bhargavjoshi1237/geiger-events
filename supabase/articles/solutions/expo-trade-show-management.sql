-- solution page: Expo & Trade Show Management (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Expo & Trade Show Management Software',
  'expo-trade-show-management',
  'Sell booths and sponsorship packages, map the floor, print badges on-site, and hand exhibitors real lead retrieval instead of a shoebox of business cards.',
  $html$<p>An expo is a marketplace you have to build from scratch every time. Exhibitors are buying booths and expecting a floor position, a package of benefits, and — above all — leads they can follow up on. Attendees need to register, get in the door fast, and find the booths worth their time. And you're in the middle, selling floor space, assigning locations, printing badges for a crowd, and fielding the question every exhibitor asks after the show: "so how many leads did I actually get?" Cobble this together from a booth-sales spreadsheet, a badge vendor, and paper lead forms, and the answer is always "let me get back to you."</p>

<h2>Why trade shows strain generic event tools</h2>
<p>Most event software is built around a stage and an audience, not a floor full of vendors. It has no concept of a booth, no way to package sponsorship tiers, and no lead capture for exhibitors. So the commercial heart of a trade show — selling space and proving ROI to the people who bought it — happens entirely outside the system, in documents and email, disconnected from your registration data.</p>

<h2>The floor and the door in one system</h2>
<p>Geiger Events handles both sides of an expo: the exhibitors buying and staffing booths, and the attendees registering and walking the floor — from the same source of truth.</p>

<h3>Booths and sponsorship packages</h3>
<p>Sell <a href="/features/events/sponsors-exhibitors">expo booths and sponsorship packages</a> as structured products, so every exhibitor knows exactly what they've purchased — booth size, placement, logo tier, benefits — and you have a clean record instead of a pile of custom quotes. A floor plan maps booths to positions, so assigning and reassigning space is a visual task, not a game of spreadsheet coordinates.</p>

<h3>Lead retrieval that proves ROI</h3>
<p>This is what exhibitors are really paying for. With <a href="/features/events/lead-retrieval">lead retrieval</a>, booth staff scan an attendee's badge to capture a qualified contact on the spot, and every exhibitor gets a real, exportable lead report. No paper forms, no lost cards, no "we'll follow up." When exhibitors can measure what they got, they come back next year — and renewals are the lifeblood of a recurring show.</p>

<h3>Registration and badges at expo scale</h3>
<p>Register attendees through proper <a href="/features/events/event-ticketing-payments">ticketing</a> with tiers, group registration, and discount codes, on Stripe payments with transparent low fees detailed on the <a href="/pricing">pricing page</a>. On show day, print name badges on-site with <a href="/features/events/badge-printing">badge printing</a> that reads straight from live registration data — including walk-ups who register at the desk — so the entrance line keeps moving and every badge carries the QR code exhibitors will scan.</p>

<h3>Check-in and live floor numbers</h3>
<p>The <a href="/features/events/event-check-in-app">check-in app</a> scans attendees in at entry and works offline when a convention-center network buckles under the crowd, giving you live headcount and, together with lead retrieval, an accurate picture of floor traffic. You can tell a sponsor how many people came through, not just how many registered.</p>

<h2>What changes when the marketplace is in the software</h2>
<p>Booth sales and sponsorship become tracked products instead of loose quotes. The floor plan replaces the coordinate spreadsheet. Badges print from live data instead of a stale export. And exhibitors leave with lead reports that make the renewal conversation easy. The commercial engine of your show — selling space and proving its value — finally lives in the same place as everything else.</p>

<blockquote>Built for expo and trade-show organizers who want booth and sponsorship sales, floor mapping, on-site badges, and exhibitor lead retrieval in one system.</blockquote>

<p>See how registration fees compare on the <a href="/pricing">pricing page</a>, or start building your expo today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'The commercial engine of your show, finally in one place',
  'Sell booths and sponsorship packages, map the floor, print badges on-site, and give exhibitors lead retrieval that proves their ROI.',
  'Start with Geiger Events',
  'Expo & Trade Show Management Software | Geiger Events',
  'Sell booths and sponsorship packages, map the floor, print badges on-site, and hand exhibitors real lead retrieval — all in one trade show platform.',
  array['trade show management software','expo management software','exhibitor lead retrieval','booth sales software','trade show badge printing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
