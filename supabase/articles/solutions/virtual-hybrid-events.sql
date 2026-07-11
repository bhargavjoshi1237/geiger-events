-- solution page: Virtual & Hybrid Events (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Virtual & Hybrid Event Platform',
  'virtual-hybrid-events',
  'Run livestreams, webinars, and breakout rooms gated by ticket, keep in-person and online audiences on one registration, and turn every session into on-demand replay.',
  $html$<p>Running an event online is deceptively hard. The video part looks solved — plenty of tools stream a talk — but the event part isn't. You still have to sell or gate access, know who actually attended which session, keep an in-person crowd and a remote crowd on the same page, and turn the whole thing into something people can watch afterward. So virtual events end up glued together from a webinar tool, a separate ticketing link, a spreadsheet matching registrations to stream logins, and a scramble to post recordings a week later once the momentum is gone.</p>

<h2>The seam between "streaming" and "an event"</h2>
<p>A meeting link isn't an event. It doesn't know who paid, it can't hold a paid session behind a ticket, and it forgets everyone the moment the call ends. For hybrid events the gap is worse: your in-person registrations and your online ones live in two different systems, so you can never see the full audience, and the online attendees feel like an afterthought instead of part of the room.</p>

<h2>Access, sessions, and audience in one system</h2>
<p>Geiger Events treats the stream as one part of an event that also has tickets, a schedule, an audience, and an afterlife — all managed together.</p>

<h3>Rooms gated by ticket</h3>
<p>Host talks in <a href="/features/events/livestream-webinar-rooms">livestream and webinar rooms</a>, and run smaller sessions in breakout rooms. Access is controlled by the ticket someone holds, so a paid track, a members-only session, or an all-access pass each open the right rooms and nothing else. There's no separate login list to reconcile — the ticket is the key.</p>

<h3>One registration for in-person and online</h3>
<p>Sell in-person, virtual, and hybrid passes from the same <a href="/features/events/event-ticketing-payments">ticketing</a> flow, with tiers and discount codes, payments on Stripe, and transparent low fees detailed on the <a href="/pricing">pricing page</a>. Because it's one registration, your <a href="/features/events/attendee-crm">attendee CRM</a> holds the complete audience — everyone who showed up in the room and everyone who joined the stream — instead of splitting them across tools you have to merge later.</p>

<h3>Engagement that makes online feel live</h3>
<p>Keep remote attendees participating with live polls and Q&A during sessions, so the online audience is contributing rather than passively watching. For hybrid events, the same interaction layer lets in-room and at-home attendees answer the same poll and ask the same speaker, which is what actually makes hybrid feel like one event instead of two.</p>

<h3>Recordings and replay by default</h3>
<p>Sessions become recordings and on-demand replay, so registrants who missed a slot can catch up and post-event access has real value. The replay lives with the same event and the same access rules, so a ticket that unlocked the live session unlocks the recording too — no re-uploading to a third-party host, no separate gate.</p>

<h2>Check-in works online too</h2>
<p>Knowing who attended is as important virtually as it is on a door. Session-level attendance shows you which talks drew a crowd and which registrants actually watched, feeding the same live numbers you'd get from an in-person <a href="/features/events/event-check-in-app">check-in app</a>. For hybrid events, on-site attendees scan in while online attendees are tracked by session entry, so your attendance picture covers the whole audience.</p>

<h2>What changes when it's one platform</h2>
<p>Access is enforced by the ticket instead of a copied-over login list. Your audience is whole instead of split down the in-person/online seam. Sessions turn into replay automatically instead of a post-event chore. And engagement makes the online crowd part of the event rather than a stream in the corner. The video was never the hard part — the event around it was, and that's the part this handles.</p>

<blockquote>Built for teams running virtual and hybrid events who want rooms gated by ticket, one audience across in-person and online, and every session available as replay.</blockquote>

<p>See how pass pricing works on the <a href="/pricing">pricing page</a>, or start building your virtual or hybrid event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Streaming was never the hard part — the event around it was',
  'Livestream, webinar, and breakout rooms gated by ticket, one audience across in-person and online, and every session as on-demand replay.',
  'Start with Geiger Events',
  'Virtual & Hybrid Event Platform | Geiger Events',
  'Run livestreams, webinars, and breakout rooms gated by ticket, keep in-person and online audiences on one registration, and turn every session into replay.',
  array['virtual event platform','hybrid event software','webinar event platform','livestream events','online event ticketing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
