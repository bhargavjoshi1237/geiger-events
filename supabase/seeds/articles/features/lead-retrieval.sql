-- feature page: Exhibitor Lead Retrieval (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Exhibitor Lead Retrieval',
  'lead-retrieval',
  'Let exhibitors and sponsors scan attendee badges at their booths to capture leads, then hand off a clean, exportable contact list for follow-up.',
  $html$<p>The whole reason a company pays to exhibit is the conversation at the booth — and the contact that outlives it. If the only record of that conversation is a bowl of business cards and a rep's memory, the value leaks out the moment the event ends. Lead retrieval in Geiger Events turns a badge scan into a captured contact, so your exhibitors leave with a list they can actually follow up on.</p>

<h2>Scan a badge, capture a lead</h2>
<p>When an attendee stops by a booth, the exhibitor scans the QR on their badge or ticket and the attendee's details are captured as a lead — name, company, title, email, phone, and a note the rep can add on the spot. Because the scan reads the same code your <a href="/features/events/event-check-in-app">check-in and badges</a> already use, there's nothing extra to issue: every attendee is already scannable the instant they're admitted.</p>

<h3>Every lead attributed</h3>
<p>Each captured contact records which exhibitor collected it and which event it came from, so a single roster stays organized across a whole expo. As an organizer you can see leads across all events, filter down to one event, and search by attendee name, company, or email to find a specific contact — the raw material for handing each exhibitor exactly their own leads.</p>

<h2>A clean hand-off, not a shoebox</h2>
<p>The point of lead retrieval is the follow-up, and follow-up needs data that's ready to use. Every lead is exportable as a CSV with the full contact — name, company, title, email, phone, the capturing exhibitor, the event, and any notes — so you can pass a clean file to each sponsor the moment doors close, or feed it into their CRM. No transcribing business cards, no chasing reps for their stack, no guessing who talked to whom.</p>

<h3>Value your sponsors can see</h3>
<p>Lead retrieval is one of the most concrete things you can offer a sponsor, because it produces a number they care about: contacts captured. When you can show an exhibitor exactly how many qualified leads their booth pulled and hand them the list, renewing that sponsorship next year is a much easier conversation. Those same contacts also enrich your own <a href="/features/events/attendee-crm">attendee CRM</a>, so the event's networking becomes data you keep.</p>

<h2>Part of the on-site toolkit</h2>
<p>Lead retrieval works because it shares the same foundation as the rest of the door: QR tickets, wallet passes, badge printing, and check-in all reference one attendee list. A person is admitted once, wears one scannable badge, and every booth that scans it captures a lead against that same identity. Nothing is issued twice, and nothing has to be reconciled afterward.</p>

<p>For how the full on-site suite fits together, see the <a href="/features/events/event-check-in-app">check-in page</a>, and check what's included on each plan on the <a href="/pricing">pricing page</a>.</p>

<h2>Why it matters</h2>
<p>Exhibitors judge an event by the pipeline it produces. When lead capture is fast, attributed, and exportable, your sponsors walk away with something they can measure and act on — and an event that reliably delivers leads is an event exhibitors come back to. Turning the badge scan they already do into a captured contact is the difference between a booth that generated interest and a booth that generated a list.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Turn a badge scan into a captured lead',
  'Let exhibitors scan attendee badges to capture leads, then hand off a clean, exportable contact list for follow-up.',
  'Start with Geiger Events',
  'Exhibitor Lead Retrieval for Events | Geiger Events',
  'Let exhibitors and sponsors scan attendee badges to capture leads at their booths, then export a clean contact list for follow-up. Value your sponsors can measure.',
  array['exhibitor lead retrieval','event lead capture','booth lead scanning','sponsor lead retrieval','trade show leads'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
