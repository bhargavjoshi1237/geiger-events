-- feature page: Reusable Event Templates (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Reusable Event Templates',
  'event-templates',
  'Save an event''s setup — format, capacity, visibility, and defaults — as a reusable template, then spin up the next event from it in a couple of clicks.',
  $html$<p>If you run the same kind of event more than once, you already know the tax: re-typing the format, the capacity, the visibility, the timezone, and the same tired description every single time. Event templates kill that busywork. Save a starting point once, and every future event begins pre-filled instead of blank.</p>

<h2>Save any event as a template</h2>
<p>A template captures the reusable shape of an event — a name, a category, an icon, a short description, and a blueprint of defaults: format (in-person, online, or hybrid), capacity, visibility, and timezone. It is not a one-off copy; it is a pattern you reach for again and again. Build your "Monthly Community Meetup" or "Beginner Workshop" once and it sits in your library ready to go.</p>

<h3>Organized so you can find them</h3>
<p>Templates are grouped by category and searchable by name, so a library of ten or fifty stays navigable. Each card shows how many events have been launched from it, so you can see at a glance which patterns you actually reuse.</p>

<h2>Launch a new event in a couple of clicks</h2>
<p>Using a template creates a fresh draft event seeded from its blueprint — format, capacity, visibility, and timezone all pre-filled — and drops you straight into the event editor to finish the specifics. You set the date and the details that genuinely change; everything that stays the same is already there. It is the difference between starting at zero and starting at eighty percent done.</p>

<h3>Edit, duplicate, and prune</h3>
<p>Templates are living records. Edit one to update the defaults it hands out, duplicate a close-enough template as the basis for a new variant, or delete the ones you have outgrown. Changing a template shapes the next event you create from it — your past events are untouched.</p>

<h2>Where templates fit</h2>
<p>Templates are the fast on-ramp to the rest of the platform. Once a draft is created, it flows into the same <a href="/features/events/event-page-builder">event page builder</a>, <a href="/features/events/event-ticketing-payments">ticketing</a>, and registration tools every event uses — the template just gets you to the starting line faster. For events that repeat on a fixed cadence rather than an occasional one, pair templates with <a href="/features/events/event-series-recurring">event series and recurring events</a>, where each new edition inherits from the last automatically.</p>

<p>Teams running a steady drumbeat of similar events — a weekly class, a monthly mixer, a quarterly summit — get the most out of templates because the marginal cost of the next event drops close to nothing. Set the pattern once, reuse it forever, and spend your time on the part that actually changes: the program, the guests, and the promotion.</p>

<h2>Consistency without copy-paste</h2>
<p>Beyond speed, templates keep your events consistent. The same capacity rules, the same default visibility, the same category and framing every time — no drift because someone forgot a setting. When your brand shows up the same way at every event, attendees learn what to expect, and you stop re-litigating decisions you already made.</p>

<p>Templates cost nothing extra to use and there is no cap on how many you keep — see the <a href="/pricing">pricing page</a> for how plans work. Build a library that matches the way you actually run events, and the next launch is always the quickest one you have done.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Launch your next event in a couple of clicks',
  'Save an event''s format, capacity, and visibility as a reusable template, then start every future event pre-filled instead of blank.',
  'Start with Geiger Events',
  'Event Templates | Reusable Event Setups | Geiger Events',
  'Save an event''s format, capacity, and visibility as a reusable template and launch the next event in a couple of clicks. Consistent setups, no copy-paste.',
  array['event templates','reusable event templates','event setup template','event planning template','clone an event'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
