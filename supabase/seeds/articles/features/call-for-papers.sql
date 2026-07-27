-- feature page: Call for Papers & Speaker Portal (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Call for Papers & Speaker Portal',
  'call-for-papers',
  'Collect session and talk proposals, score and review submissions, accept the best, and give speakers a portal to manage their details — the whole speaker intake pipeline in one place.',
  $html$<p>The best conference programs start with an open call. But collecting proposals over email, tracking them in a shared sheet, and coordinating reviewer scores across a committee is exactly the kind of work that eats a week and still loses submissions. Geiger Events gives you a real call-for-papers pipeline — proposals in, review and scoring in the middle, accepted talks straight onto the agenda — plus a speaker portal so presenters manage their own details.</p>

<h2>Collect proposals in a structured pipeline</h2>
<p>Every submission comes in as its own record: title, author, contact email, track, format, and a full abstract, with topics attached. Whether someone's pitching a talk, a workshop, or a panel, the format is captured up front so you can filter and balance your program by type. Filter the whole pool by status or format, search across titles, authors, and tracks, and see at a glance how many proposals you've received.</p>

<h3>Every submission has a clear status</h3>
<p>Proposals move through their own lifecycle — submitted, under review, accepted — so nothing sits in limbo. The stats bar shows how many are accepted, how many are still under review, and your overall accept rate, which keeps a program committee honest about where the pool stands without anyone tallying it by hand.</p>

<h2>Score and review, together</h2>
<p>Reviewing is where a call for papers usually falls apart, because scores and opinions scatter across inboxes. Here each submission carries a reviewer score and reviewer notes right on the record, so the committee's read on a proposal lives with the proposal itself. Score talks on a simple scale, leave notes on strengths and concerns, and sort the strongest to the top when it's time to decide.</p>

<blockquote><p>A good abstract, a clear track, a score, and a note on why — that's everything the room needs to make the call, in one place instead of five threads.</p></blockquote>

<h2>Accepted talks become sessions and speakers</h2>
<p>The payoff of a structured intake is that acceptance isn't a dead end — it's a handoff. When you accept a submission, the talk is ready to flow onto your program and the author becomes a speaker, so the work you did reviewing feeds directly into the <a href="/features/events/conference-agenda-speakers">agenda builder and speaker profiles</a>. No re-keying titles, no re-typing bios, no copying abstracts from one tool to another.</p>

<h2>A portal for your speakers</h2>
<p>Once someone's accepted, they have their own details to manage — bio, headshot, session information, links. The speaker portal gives presenters a place to keep that current themselves, so you're not chasing every speaker over email for an updated photo the week before the event. The details they maintain feed the public speaker pages and the agenda, keeping everything attendees see accurate without a manual middle step.</p>

<h3>Less coordination, better speakers</h3>
<p>When the intake is organized and the follow-up is self-service, you spend your time choosing a great lineup instead of administering it. That's the whole point — the call for papers should help you find the best sessions, not become a project of its own.</p>

<h2>Part of the full conference toolkit</h2>
<p>Call for papers is the front door to your program, and it connects to everything downstream — the agenda, the speaker pages, the sessions attendees save. See how it fits alongside sponsors, expo, and scheduling in the complete picture for <a href="/solutions/events/conference-event-software">conferences and summits</a>. Whether you're programming a single-track community event or a multi-track summit, a structured call gets you a stronger lineup with less chasing.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Run an open call, pick the best sessions',
  'Collect proposals, score and review submissions with your committee, accept the best straight onto the agenda, and let speakers manage their own details.',
  'Start with Geiger Events',
  'Call for Papers Software & Speaker Portal | Geiger Events',
  'Collect session proposals, score and review submissions with your committee, accept the best onto the agenda, and give speakers a self-service portal.',
  array['call for papers software','abstract management','session submission software','speaker portal','conference cfp'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
