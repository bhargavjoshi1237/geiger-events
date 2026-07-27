-- feature page: Event Series & Recurring Events (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Event Series & Recurring Events',
  'event-series-recurring',
  'Run a repeating event without rebuilding it each time — group editions into a series, set a recurrence rule, and let every new edition inherit the last.',
  $html$<p>A weekly class, a monthly meetup, a first-Friday social — the whole point of a recurring event is that it repeats. So why do most tools make you rebuild it from scratch every time? Geiger Events treats a repeating event as one thing you manage, not a pile of disconnected copies. Group the editions into a series, define how it repeats, and each new edition starts from the shape of the last.</p>

<h2>Group editions into a series</h2>
<p>An event series bundles related events under one roof — a cadence (weekly, monthly, or whatever fits), a shared visibility setting, and a description of what ties them together. Attendees can follow the whole run instead of hunting for each date, and you manage the shared settings in one place. Every edition rolls up to the series, so you can see the count of grouped events, the next upcoming date, and the overall status without opening each one.</p>

<h3>Shared defaults, per-edition freedom</h3>
<p>A series carries defaults — format, capacity, timezone, organizer — that seed each new edition. Add an event to the series and it starts pre-filled from those defaults, then you adjust only what changes for that date. The series keeps the run coherent; each edition still stands on its own.</p>

<h2>Set a recurrence rule</h2>
<p>Define how the event repeats with a recurrence rule: daily, weekly, or monthly, on an interval you choose (every week, every two weeks), on specific weekdays for weekly events. Decide how it ends — never, on a specific date, or after a set number of occurrences — and generate the upcoming editions from that rule. A plain-language summary confirms exactly what you set before anything is created, so "every 2 weeks on Tue, 8 times" is never a guess.</p>

<h2>Each edition inherits the last</h2>
<p>The heart of recurring events is inheritance. When you add the next edition, it comes pre-built from the pattern — the format, the capacity, the settings you already dialed in — so you are editing a near-complete event, not starting over. Need a genuine fresh copy of a specific event, series or not? Clone it and change the date. Either way, the work you did once carries forward.</p>

<h3>Manage the run in one place</h3>
<p>From the series view you can add a new edition, detach an event back to standalone, or retire the series — and its editions return to the standalone pool rather than disappearing. Statuses and next-up dates stay visible across the whole run, so a busy calendar of repeating events stays legible.</p>

<h2>Where series fit</h2>
<p>For the occasional repeat — the same event shape you reach for now and then — <a href="/features/events/event-templates">event templates</a> are the lighter tool: save the pattern, launch when you need it. Series are for events on a rhythm, where following the run and inheriting the last edition matter. Both feed into the same <a href="/features/events/event-page-builder">event pages</a>, <a href="/features/events/event-ticketing-payments">ticketing</a>, and check-in, so a recurring event is a first-class event, not a second-class copy. If most of what you run repeats, the <a href="/solutions/events/recurring-events">recurring events</a> workflow is built around exactly this.</p>

<p>The payoff compounds: the more often an event repeats, the more time the series saves. Set the cadence once, let each edition inherit the last, and your recurring program runs on rails. Pricing scales with your events, not with how often they repeat — see the <a href="/pricing">pricing page</a>.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Run a repeating event without rebuilding it',
  'Group editions into a series, set a recurrence rule, and let each new edition inherit the last — recurring events that manage themselves.',
  'Start with Geiger Events',
  'Recurring Events Software | Event Series | Geiger Events',
  'Run recurring events without rebuilding them — group editions into a series, set a recurrence rule, and let each new edition inherit the last. Clone any event.',
  array['recurring events software','event series','repeating events','recurring event scheduling','clone an event'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
