-- feature page: Livestream & Webinar Rooms (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Livestream & Webinar Rooms',
  'livestream-webinar-rooms',
  'Host sessions online with livestream and webinar rooms, breakout spaces, speaker backstage, and recordings — with access gated by ticket type, all inside the same event.',
  $html$<p>Running the online side of an event usually means stitching together a video tool, a registration tool, and a replay host, then hoping the access rules line up. Geiger Events puts the virtual room inside the same event as everything else, so who gets in is decided by the ticket they hold and the recording is waiting where they'd expect it.</p>

<h2>Rooms for every format</h2>
<p>Host a main livestream for keynotes and general sessions, run structured webinar rooms for talks, and open breakout rooms for smaller-group sessions and networking. One event can carry all three, matching the shape of an in-person program online.</p>

<h3>Speaker backstage</h3>
<p>Presenters prepare and wait in a backstage before they go live, so the transition on and off screen is clean and the audience only ever sees the polished side of the session.</p>

<h2>Access gated by ticket</h2>
<p>Virtual sessions respect the same <a href="/features/events/event-ticketing-payments">ticketing</a> that everything else does. Access to a room can be gated by ticket type or registration status, so a general pass and an all-access pass see different sessions — the same way tiers work at the door of a physical event. No separate access list to maintain.</p>

<h2>Recordings and on-demand</h2>
<p>Sessions are recorded for replay, so attendees who missed a talk — or want to rewatch it — can come back to it after the event. Simulive and on-demand let a recorded session play on a schedule or stay available as a library, and captions and transcription make the content accessible and searchable.</p>

<h2>The same event, online and in the room</h2>
<p>Because virtual rooms sit inside the event, they share its <a href="/features/events/attendee-crm">attendee list</a>, its <a href="/features/events/conference-agenda-speakers">agenda and speakers</a>, and its <a href="/features/events/event-analytics">analytics</a> — so a hybrid event is one event with an online audience, not two systems you reconcile afterward.</p>

<h2>What changes for you</h2>
<p>The online experience stops being a bolt-on. Attendees join the right rooms based on the ticket they bought, presenters have a real backstage, and every session is there to rewatch — all under one roof. Explore the full <a href="/solutions/events/virtual-hybrid-events">virtual and hybrid toolkit</a>, or see how it fits your plan on the <a href="/pricing">pricing page</a>.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Host the online room inside the same event',
  'Livestream, webinar, and breakout rooms with speaker backstage and recordings — access gated by ticket type, no second system to reconcile.',
  'Start with Geiger Events',
  'Livestream & Webinar Rooms for Virtual Events | Geiger Events',
  'Host livestream, webinar, and breakout rooms with speaker backstage and recordings, access gated by ticket type — virtual and hybrid events in one place.',
  array['virtual event platform','webinar rooms','livestream events','hybrid event software','breakout rooms'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
