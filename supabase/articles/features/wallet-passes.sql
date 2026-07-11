-- feature page: Apple & Google Wallet Passes (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Apple & Google Wallet Passes',
  'wallet-passes',
  'Give every attendee a tap-to-enter ticket in Apple Wallet and Google Wallet, alongside a standard QR ticket, so check-in is a single tap at the door.',
  $html$<p>The paper printout gets left at home. The confirmation email gets buried. The screenshot goes blurry. A wallet pass sits on the attendee's lock screen, ready the moment they walk up to your door — no digging, no searching an inbox in a queue. Geiger Events generates an Apple Wallet and Google Wallet pass for every ticket, so the fastest thing an attendee already carries becomes their ticket.</p>

<h2>A ticket in the wallet they already use</h2>
<p>When someone buys or registers, their ticket can be added to Apple Wallet on iPhone and Google Wallet on Android in one tap. You choose which wallets to offer, so you can turn on one or both. The pass rides along with the standard QR ticket rather than replacing it — attendees who prefer the emailed QR still have it, and the two carry the same code, so a scanner reads either one the same way.</p>

<h3>Branded to your event</h3>
<p>The pass isn't generic. Set your organization name, a background color, and a logo so the card in the wallet looks like it came from you, not a marketplace. You control which details print on the front — the attendee's name, the ticket type, a seat or table assignment, and the QR code itself — so a VIP pass reads differently from general admission at a glance.</p>

<h2>Faster check-in at the door</h2>
<p>Wallet passes are built for tap-and-go entry. The attendee brings the pass up on their phone, your staff scans the QR, and they're in. Because the pass lives on the lock screen, there's no unlocking, no app, and no hunting for the right email — which is exactly what you want when a line forms. It plugs straight into the rest of <a href="/features/events/event-check-in-app">check-in and on-site operations</a>, so the same scan that admits a QR ticket admits a wallet pass, and your <a href="/features/events/event-check-in-app">real-time attendance</a> count stays accurate either way.</p>

<h3>Turn it on per event</h3>
<p>Wallet passes are a project-level feature you enable once and then switch on for each event from the event editor's check-in settings. A free community meetup and a paid conference can each decide independently whether to offer wallet passes, so you're never forced into one behavior across every event you run.</p>

<h2>Where wallet passes fit</h2>
<p>Wallet passes work best as one option in a complete check-in toolkit rather than a standalone gimmick. Pair them with QR tickets for attendees who like the email, <a href="/features/events/event-check-in-app">badge printing</a> for events where a physical badge matters, and name-search lookup for the person who arrives with a dead battery. Every path admits the same attendee against the same list, and each entry flows back to your <a href="/features/events/attendee-crm">attendee CRM</a> so you know exactly who showed up.</p>

<p>Because a wallet pass is tied to a real ticket, it inherits everything ticketing already does — the buyer's details, the ticket type, and any seat assignment. If you sell paid tickets, see how checkout and pricing work on the <a href="/features/events/event-ticketing-payments">ticketing page</a>, and check the <a href="/pricing">pricing page</a> for what's included on each plan.</p>

<h2>Why it matters</h2>
<p>Every second saved at the door compounds across hundreds of arrivals. Wallet passes cut the fumbling that slows a line, reduce the "I can't find my ticket" conversations your staff have to referee, and make your event feel a step more professional before an attendee has even walked in. It's a small thing the attendee barely notices — which is the point.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Tickets that live in the wallet',
  'Generate Apple Wallet and Google Wallet passes for every ticket, alongside QR, for tap-to-enter check-in.',
  'Start with Geiger Events',
  'Apple & Google Wallet Event Tickets | Geiger Events',
  'Give attendees Apple Wallet and Google Wallet passes alongside QR tickets, branded to your event, for fast tap-to-enter check-in at the door.',
  array['apple google wallet tickets','wallet passes','mobile event tickets','tap to enter check-in','apple wallet event pass'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
