-- feature page: Community & Engagement Tools (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Community & Engagement Tools',
  'event-community-engagement',
  'Polls, surveys, Q&A, announcements, event chat, direct messaging, discussion boards, and a meeting scheduler — the tools that turn an audience into a participating community.',
  $html$<p>An audience watches; a community takes part. The gap between the two is interaction — the chance to answer a question, ask one, meet someone, or say something back. Geiger Events gives you a set of community and engagement tools that turn passive attendees into active participants, before, during, and after the event.</p>

<h2>Get the room talking</h2>
<p>Engagement starts with two-way moments. Run polls to take the temperature of a room in real time and put the results on screen. Open a Q&A so attendees can ask questions and surface the ones that matter most, instead of a few loud voices dominating a mic. Send announcements to reach everyone the instant something changes — a room switch, a schedule shift, a last call. These are the interactions that make people feel present rather than talked at.</p>

<h3>Ask, and learn</h3>
<p>Some questions deserve more than a live poll. Surveys let you gather structured feedback — after a session, after the whole event — so the next one is better informed than the last. The responses become part of what you know about your audience, feeding the picture in your <a href="/features/events/attendee-crm">attendee CRM</a> rather than living in a disconnected form tool.</p>

<h2>Let attendees connect with each other</h2>
<p>The most valuable thing at many events isn't on the agenda — it's the person in the next seat. Event chat gives attendees a shared space to talk during the event, discussion boards give conversations somewhere to live beyond a single moment, and direct messaging lets two people take it one-to-one. A meeting scheduler helps attendees turn "we should talk" into an actual slot, so the networking that everyone hopes for actually gets booked.</p>

<h3>Community that lasts past the last session</h3>
<p>Engagement tools don't have to switch off when the event ends. Boards and chat keep a community warm between events, which is exactly the kind of ongoing relationship that pairs naturally with <a href="/features/events/memberships">memberships</a> and with the followers on your organizer profile. The interaction you spark at one event becomes a reason people come back to the next, and a place they'll check before you've even announced it.</p>

<h3>Reach everyone at once, or one person at a time</h3>
<p>Different moments call for different volume. Announcements broadcast to the whole room when something changes and everyone needs to know now. Direct messaging and the meeting scheduler operate at the other end of the dial, letting two people find each other and lock in a time without the noise of a group thread. Between them sit polls, Q&A, chat, and boards — the middle ground where a room thinks out loud together. Having the full range in one place means you match the tool to the moment instead of forcing every interaction through a single channel.</p>

<h2>Part of one platform</h2>
<p>Because these tools live inside Geiger Events, they sit on the same attendee data as everything else — ticketing, check-in, and your contact records — so the people polling, asking, and messaging are the same people on your list. You can even wire engagement into an <a href="/features/events/event-automation">automated workflow</a>, sending a post-event survey the moment someone checks out. It's engagement that connects to the rest of the event rather than bolting on from the outside.</p>

<p>For how the surrounding pieces work together, start with your <a href="/features/events/attendee-crm">attendee records</a>, and see what's included on each plan on the <a href="/pricing">pricing page</a>.</p>

<h2>Why it matters</h2>
<p>Attendees remember how an event made them feel, and participation is a big part of that feeling. When people can weigh in, ask questions, and meet each other, they leave more satisfied, give better feedback, and are far more likely to return — and to tell someone else. Community tools are how you convert a one-time crowd into an audience that keeps showing up.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Turn attendees into participants',
  'Polls, surveys, Q&A, announcements, chat, messaging, discussion boards, and a meeting scheduler that make attendees take part.',
  'Start with Geiger Events',
  'Event Engagement & Community Tools | Geiger Events',
  'Polls, surveys, Q&A, announcements, event chat, direct messaging, discussion boards, and a meeting scheduler — turn a passive audience into a participating community.',
  array['event engagement tools','event community platform','event polls and q&a','attendee networking','event chat'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
