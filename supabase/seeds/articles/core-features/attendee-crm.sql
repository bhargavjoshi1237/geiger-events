-- feature page: Attendee CRM & Contacts (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Attendee CRM & Contacts',
  'attendee-crm',
  'A contact book that becomes your audience — guest lists, who is going, segments, tags, notes, import, duplicate merging, exports and consent-aware data requests, all in one hub.',
  $html$<p>Most event tools treat your attendees as a spreadsheet you export and forget. The people who came to your last event are the most likely people to come to your next one — and if they live in a dead CSV, that value evaporates. Geiger Events keeps them in a proper contact book that grows with every event, so your audience compounds instead of resetting each time.</p>

<h2>One contact book, every attendee</h2>
<p>The Contact Book is the hub. Everyone who registers, buys a ticket, or gets added lands here as a real contact with their history attached — not a one-off row on a single event's list. Open a contact to see who they are, what they've come to, and everything you know about them in one place.</p>

<h3>Guest list and who's going</h3>
<p>See your all-time roster as the guest list, or narrow to just the upcoming crowd with the who's-going view. One lens tells you the full relationship; the other tells you who to expect at the door next week. Both read from the same contacts, so they never disagree.</p>

<h2>Organize your audience</h2>
<h3>Segments and tags</h3>
<p>Group people the way you actually think about them. Build segments for VIPs, first-timers, repeat attendees, or anyone matching the criteria you set, and apply tags to mark contacts by interest, tier, or source. Those same segments become the audiences you target with <a href="/features/events/event-email-sms-marketing">email and SMS campaigns</a>, so the right message reaches the right people.</p>

<h3>Notes</h3>
<p>Keep the context that a database field can't hold. Leave notes on a contact — a dietary preference, a sponsor relationship, a "always brings three friends" — and your whole team sees it. The cross-contact note feed keeps that institutional memory from living in one person's head.</p>

<h2>Clean data you can trust</h2>
<h3>Import and dedupe</h3>
<p>Bring in the audience you already have with import, so past attendees and existing lists start in the contact book on day one. When the same person shows up twice, find and merge the duplicates so their history lands on a single record instead of splintering across three.</p>

<h3>Export whenever you need it</h3>
<p>Your data is yours. Export attendees and contacts however you need — a full audience, a single event's list, or a specific segment — for reporting, a partner, or your own records. No lock-in, no hoops.</p>

<h2>Respect consent and privacy</h2>
<p>Handle privacy properly with data requests: work through consent-aware requests for a contact's data so you can honor access and deletion asks without a fire drill. Treating attendee data responsibly isn't just good manners — it's what keeps you on the right side of your audience's trust and your obligations.</p>

<h2>The CRM that ties your events together</h2>
<p>Because the contact book sits under every event, the whole platform feeds it and reads from it. A <a href="/features/events/event-registration-rsvp">registration</a> creates a contact; a <a href="/features/events/event-ticketing-payments">ticket purchase</a> attaches an order to it; a <a href="/features/events/event-check-in-app">check-in</a> records that they actually showed. Over time each contact becomes a real history — every event they came to, every ticket they bought, every message they got — and that history is what turns one-time attendees into a following.</p>

<p>When you plan your next event, you're not starting from zero. You segment the people who came before, message them first, and watch your repeat rate climb. That's the whole point of a CRM built for events instead of a list you dump after the doors close: your audience is an asset, and this is where it lives and grows.</p>

<p>Start with the contacts you have, let every event add to them, and keep the relationship going between events instead of rebuilding it each time.</p>

<p>The payoff shows up in the numbers that matter. Repeat attendance is the cheapest growth you'll ever get — nobody is easier to sell than someone who already had a good time with you — and it only exists if you can find those people again. A contact book that remembers every event, every ticket, and every note is how you do that at scale, whether you run one event a quarter or several a week.</p>

<p>It's also how a small team stays coordinated. Because contacts, notes, and segments are shared, everyone works from the same view of your audience instead of a personal spreadsheet — so a handoff between organizers, or a new team member's first week, doesn't start from a blank page.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Turn attendees into an audience that comes back',
  'A contact book that grows with every event — guest lists, segments, tags, notes, import, dedupe, exports and consent-aware data requests in one hub.',
  'Start with Geiger Events',
  'Event CRM & Attendee Management | Geiger Events',
  'Keep every attendee in one contact book — guest lists, segments, tags, notes, import, duplicate merging, exports and consent-aware data requests.',
  array['event crm','attendee management','event contact management','audience segmentation','guest list software'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
