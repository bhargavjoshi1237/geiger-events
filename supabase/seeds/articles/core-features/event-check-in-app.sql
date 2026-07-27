-- feature page: Check-in & On-site Operations (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Check-in & On-site Operations',
  'event-check-in-app',
  'Scan QR tickets and wallet passes with a fast check-in app that works offline — plus door sales, kiosk self check-in, multi-gate zones, name search, staff roles and real-time attendance.',
  $html$<p>The door is where all your planning meets a line of real people. A slow or unreliable check-in turns a great event into a bad first impression before anyone's through the entrance. Geiger Events gives you an on-site operation built for speed: scan a ticket, admit the guest, and keep the line moving — even when the venue Wi-Fi gives out.</p>

<h2>Fast, reliable check-in</h2>
<p>Every confirmed attendee carries a QR ticket. Point the check-in app at it, and they're admitted in a beat. The app is built for the door — big targets, instant feedback, and a clear signal when a ticket is valid, already used, or not on the list.</p>

<h3>QR tickets and wallet passes</h3>
<p>Attendees can hold their ticket as a QR code or add it to their phone's wallet, so there's nothing to print and nothing to dig through an inbox for. The same ticket that came out of <a href="/features/events/event-ticketing-payments">checkout</a> is the one they scan at the door — no separate step, no reissuing.</p>

<h3>Offline check-in</h3>
<p>Venue internet is unpredictable. The app keeps working when the connection drops, checking people in against a local copy and syncing back up once you're online again. Your line never stops because a router did.</p>

<h2>Every kind of entrance</h2>
<h3>Self check-in and kiosk mode</h3>
<p>Set up a device in kiosk mode and let attendees check themselves in — they scan or search, confirm, and walk through, which clears your staff to handle the exceptions. Perfect for a busy entrance where a queue of manual scans would back up.</p>

<h3>Door sales</h3>
<p>Not everyone buys ahead. Sell tickets right at the entrance with door sales, and the walk-up becomes a checked-in attendee in the same flow — counted, ticketed, and added to your numbers instantly.</p>

<h3>Name-search lookup</h3>
<p>When someone can't find their ticket, don't hold up the line. Search by name, confirm them, and check them in by hand. It's the escape hatch that keeps a lost phone or a flat battery from becoming a five-minute standoff.</p>

<h2>Built for teams and big venues</h2>
<h3>Multi-gate and zones</h3>
<p>Run several entrances at once and control access to specific areas with zones — a VIP section, a backstage door, a paid workshop room. Each gate scans independently, and the system knows who's allowed where, so access matches what people actually bought.</p>

<h3>Staff scanning roles</h3>
<p>Give each team member the right access. Assign scanning roles so door staff can check people in without touching your settings, sales, or attendee data. Everyone gets exactly the tool they need for their post and nothing they don't.</p>

<h2>See the room in real time</h2>
<p>Watch attendance update live as people arrive. Real-time attendance tells you how many are in, how fast they're coming through, and when the rush is hitting — so you can move staff to a backed-up gate or start on time with confidence. After the event, those same numbers feed your <a href="/features/events/event-analytics">analytics</a> for a true picture of who showed up versus who signed up.</p>

<h2>One system from ticket to door</h2>
<p>Because check-in runs on the same event as your registration, tickets, and contacts, there's no import the morning of and no separate scanner app to configure. A person <a href="/features/events/event-registration-rsvp">registers</a>, gets a ticket, shows up, and scans in — and their attendance lands right back on their record in your <a href="/features/events/attendee-crm">attendee CRM</a>. Every gate, every walk-up sale, and every manual lookup stays in sync automatically.</p>

<p>Whether you're running a single door for fifty people or a dozen gates across a festival ground, the on-site tools scale to fit: fast scans, offline resilience, self-service kiosks, door sales, and a live count you can actually trust. The door stops being the scary part of the day.</p>

<p>It also means your day-of staff can be anyone you trust with a phone, not a specialist. The app is simple enough to hand to a volunteer five minutes before doors, with a scanning role that limits them to exactly what they need. Fewer trained hands required, fewer things that can go wrong, and a faster line for everyone waiting to get in.</p>

<p>When the event ends, nothing has to be reconciled. Every scan, walk-up sale, and manual lookup already lives on the same records your reports read from, so your final headcount is done the moment the last person walks in — no clipboard to transcribe, no two systems to reconcile.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Check people in fast, even when the Wi-Fi drops',
  'Scan QR tickets and wallet passes, sell at the door, run kiosks and multiple gates, look attendees up by name, and watch attendance in real time.',
  'Start with Geiger Events',
  'Event Check-in App | Geiger Events',
  'A fast event check-in app that scans QR tickets and wallet passes, works offline, and handles door sales, kiosks, multi-gate zones and real-time attendance.',
  array['event check-in app','qr code check-in','event ticket scanner','offline check-in','event door sales'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
