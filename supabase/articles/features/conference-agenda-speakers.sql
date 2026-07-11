-- feature page: Agenda Builder & Speakers (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Agenda Builder & Speakers',
  'conference-agenda-speakers',
  'Build a multi-track conference agenda, publish speaker profiles, let attendees save a personal schedule, and check people into individual sessions — all in one place.',
  $html$<p>A conference lives or dies by its schedule. When you're juggling parallel tracks, dozens of speakers, and rooms that turn over every 45 minutes, the agenda is the single hardest thing to keep straight — and the thing attendees look at most. Geiger Events gives you a proper agenda builder, speaker pages that stay in sync with it, and a personal schedule attendees actually use, so the program you plan is the program they see.</p>

<h2>Build the schedule, track by track</h2>
<p>The agenda builder is where you sequence the whole event. Each session carries its own track, room, day, start and end time, and assigned speaker, so a multi-track program with several stages running at once stays organized instead of turning into a spreadsheet nobody trusts. Sessions move through their own statuses — draft while you're still shaping the lineup, scheduled once a slot is locked — and the stats bar shows how many sessions are confirmed, how many tracks run in parallel, and how many rooms are in use at a glance.</p>

<h3>Rooms, tracks, and timing that hold together</h3>
<p>Because room and time live on every session, you can see where two things collide before your attendees do. Give a keynote the main stage, split the afternoon into engineering and product tracks, and keep the whole thing readable from one screen. When plans shift — and they always do — you edit the session, not five different documents.</p>

<h2>Speaker profiles that stay in sync</h2>
<p>Every presenter gets a speaker record: name, title, company, bio, topics, headshot, and links to their social profiles and personal site. Track each speaker through their own pipeline — invited, confirmed, and beyond — so you always know who's actually locked in. Mark your marquee names as featured to highlight them on public speaker listings, and connect each speaker to the sessions they're presenting so the agenda and the speaker page never disagree.</p>

<p>Speaker sourcing usually starts earlier, with an open call. Our <a href="/features/events/call-for-papers">call for papers</a> tools collect and score session proposals, and the best submissions flow straight onto the agenda — the person you accept becomes a speaker and their talk becomes a session, without re-keying anything.</p>

<h2>A personal agenda for every attendee</h2>
<p>Nobody attends every session. My Agenda lets attendees browse the full program and save the talks they care about into a personal schedule, so a crowded multi-track day becomes a short, clear list of where they need to be and when. It's the difference between a program that's technically published and one people actually navigate.</p>

<h2>Check people into individual sessions</h2>
<p>For accredited programs, popular breakouts, or simply knowing which talks drew a crowd, session check-in records attendance at the session level, not just the front door. Scan attendees into a specific room and you get a real count of who was there — the same data that feeds continuing-education credits and post-event reporting. It works alongside event-wide <a href="/features/events/event-check-in-app">check-in and on-site operations</a>, so the door and the sessions share one attendee list.</p>

<h3>Why session-level data matters</h3>
<p>Knowing that four hundred people walked through the door tells you the event happened. Knowing which sessions filled the room, which speakers packed the house, and who sat through the workshop tells you what to do next year. Session check-in turns your agenda into a measurement tool, and it pairs naturally with <a href="/features/events/event-analytics">analytics and reporting</a> to show attendance and engagement across the whole program.</p>

<h2>One system, from planning to stage</h2>
<p>The agenda, the speakers, the personal schedules, and the session scans all read from the same records, so there's no export-and-reconcile step between the tool you plan in and the experience attendees get. Add <a href="/features/events/sponsors-exhibitors">sponsors and exhibitors</a> and you have the core of a full conference in one workspace. For the bigger picture — expo floors, housing, virtual rooms, and more — see how it all fits together for <a href="/solutions/events/conference-event-software">conferences and summits</a>.</p>

<p>Whether you're running a single-track community meetup or a several-hundred-session summit, the agenda builder scales to fit, and it feels the same to your attendees either way.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Build a conference agenda your attendees can actually navigate',
  'A multi-track agenda builder, speaker profiles that stay in sync, personal schedules, and session-level check-in — all in one workspace.',
  'Start with Geiger Events',
  'Conference Agenda Builder & Speaker Management | Geiger Events',
  'Build a multi-track conference agenda, publish speaker profiles, give attendees a personal schedule, and check into individual sessions — in one workspace.',
  array['conference agenda builder','event agenda software','speaker management software','multi-track agenda','session check-in'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
