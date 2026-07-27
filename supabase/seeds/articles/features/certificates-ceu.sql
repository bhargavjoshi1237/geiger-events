-- feature page: CEU & Certificates (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'CEU & Certificates',
  'certificates-ceu',
  'Define certificates and continuing-education credits, set credit hours and accrediting body, tie them to sessions attendees complete, and issue them from attendance data you already capture.',
  $html$<p>For professional conferences, workshops, and accredited training, the certificate is the reason many people register in the first place. Attendees need proof of the continuing-education credits they earned, and they need it to be accurate. Geiger Events lets you define certificates and CEU credits, tie them to the sessions that grant them, and issue them from the attendance data you're already capturing at the door and in each room.</p>

<h2>Define what attendees can earn</h2>
<p>Each certificate or credit is its own record. Choose whether it's a completion certificate or a CEU credit, set the number of credit hours it carries, and name the accrediting body behind it. Certificates move through their own lifecycle — draft while you're setting them up, active once they're issuable — so you control exactly what's available to award and when.</p>

<h3>Credit hours and accreditation, tracked</h3>
<p>The details that matter for accreditation live on the record: how many credit hours the certificate is worth, and which body accredits it. Across your program the stats bar totals the credit hours on offer and how many distinct accrediting bodies you work with, so a compliance-minded event has its numbers in one place instead of buried in a slide.</p>

<h2>Tie credits to the sessions that earn them</h2>
<p>A certificate isn't just a document — it represents work an attendee actually did. Link each certificate to the specific sessions that grant it, and add a description of what earning it involves, so the credit is anchored to real content rather than mere registration. This is what makes the credit defensible: it maps to sessions on your <a href="/features/events/conference-agenda-speakers">agenda</a> that attendees genuinely completed.</p>

<h2>Issue from attendance you already capture</h2>
<p>Because credits are tied to sessions, they build directly on attendance data. Session-level check-in records who was actually in each room, not just who walked through the front door — and that per-session attendance is the foundation for awarding CEUs honestly. When a credit requires attending specific sessions, the check-in data shows whether an attendee met the bar, so you're issuing credits on evidence, not on the honor system.</p>

<p>This works hand in hand with event-wide <a href="/features/events/event-check-in-app">check-in and on-site operations</a>: the same scans that get people into the room become the record that they earned the credit. One attendance list serves the door, the sessions, and the certificate.</p>

<h3>Reporting that backs it up</h3>
<p>Accredited programs often have to demonstrate attendance to a governing body. Because completion is grounded in session check-in data, it flows into your <a href="/features/events/event-analytics">analytics and reporting</a>, so you can show who attended what — the paper trail an accrediting body expects, without assembling it by hand after the event.</p>

<h2>Built for professional and accredited events</h2>
<p>Continuing education raises the stakes on getting attendance right, which is exactly why credits, sessions, and check-in belong in one system rather than three. Define the certificate once, connect it to the sessions that grant it, and let the attendance data do the rest. See how it fits with the agenda, speakers, and the wider program on our page for <a href="/solutions/events/conference-event-software">conferences and summits</a>.</p>

<p>Whether you're running a small accredited workshop or a multi-track professional summit, the credit an attendee walks away with reflects the sessions they actually completed — and that's what makes it worth issuing.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Issue CEU credits and certificates from real attendance',
  'Define certificates and continuing-education credits, set credit hours and accrediting body, tie them to sessions, and issue them from session check-in data.',
  'Start with Geiger Events',
  'CEU Credits & Certificates for Events | Geiger Events',
  'Define certificates and CEU credits, set credit hours and accrediting body, tie them to sessions, and issue them from the session attendance you already capture.',
  array['ceu certificates events','continuing education credits','event certificates software','ceu tracking','accredited event software'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
