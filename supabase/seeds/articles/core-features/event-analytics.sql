-- feature page: Analytics & Reporting (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Analytics & Reporting',
  'event-analytics',
  'Track sales, attendance, traffic and sources, email performance, engagement and conversion funnels — with cross-event reporting, real-time dashboards, scheduled reports, surveys and demographics.',
  $html$<p>Running an event on gut feel is expensive. You can't repeat what worked or fix what didn't if you don't know which channel sold the tickets, how many people actually walked in, or where interested visitors dropped off. Geiger Events measures the whole journey — from the first page view to the post-event survey — because every part of that journey already runs on the platform, so the data is real, not stitched together.</p>

<h2>Know how you sold and who showed</h2>
<h3>Sales</h3>
<p>See how tickets are moving as they sell — by type, over time, toward your goal. Sales analytics turn <a href="/features/events/event-ticketing-payments">ticketing</a> into a signal you can act on: push a channel that's working, adjust before a launch stalls, and know exactly where your revenue is coming from.</p>

<h3>Attendance</h3>
<p>Signed up is not the same as showed up. Attendance reporting pulls straight from <a href="/features/events/event-check-in-app">check-in</a> to tell you your real turnout, your no-show rate, and how the door actually went — the number that tells you whether the event worked, not just whether it sold.</p>

<h2>Understand what drives sign-ups</h2>
<h3>Traffic and sources</h3>
<p>See where your visitors come from — which link, channel, or campaign brought them — so you invest in what actually fills the room and stop paying for what doesn't. Traffic and source data is the difference between guessing and knowing which effort earned its keep.</p>

<h3>Conversion funnels</h3>
<p>Watch the path from page view to registration to purchase and see exactly where people fall off. If visitors land but don't register, or register but don't buy, the funnel shows you the leak so you can fix the one step that's costing you the most.</p>

<h3>Email performance</h3>
<p>Every send from your <a href="/features/events/event-email-sms-marketing">campaigns</a> reports back — how it performed and, more importantly, whether it drove sign-ups, not just opens. You learn which message moved people so the next one is sharper.</p>

<h2>The full picture, over time</h2>
<h3>Cross-event reporting</h3>
<p>One event is a data point; your whole program is the story. Cross-event reporting compares performance across everything you run, so you can see trends, spot your best-performing formats, and understand your audience as a whole rather than one night at a time.</p>

<h3>Engagement and demographics</h3>
<p>Go beyond counts to understand who your audience is and how they interact — engagement and demographic views help you tailor the next event to the people who actually come, not a generic average.</p>

<h2>Reports that come to you</h2>
<h3>Real-time dashboards</h3>
<p>During a sales push or on event day, watch the numbers update live on real-time dashboards. No refresh-and-export ritual — the state of your event is on screen the moment it changes, so you can react while it still matters.</p>

<h3>Scheduled reports</h3>
<p>Set the reports that matter to arrive on a schedule, so you and your stakeholders get the summary without anyone having to pull it. The recap lands in your inbox on time, every time, whether it's a weekly sales check or a post-event wrap.</p>

<h2>Ask your audience directly</h2>
<p>Numbers tell you what happened; surveys tell you why. Run post-event surveys and NPS to hear it in your attendees' own words — what landed, what didn't, whether they'd come back. That feedback closes the loop between one event and the next.</p>

<h2>Reporting built into the platform, not bolted on</h2>
<p>The reason these numbers are trustworthy is that nothing is imported. Sales come from real orders, attendance from real check-ins, traffic from your real event page, campaign results from your real sends, and attendees from your real <a href="/features/events/attendee-crm">CRM</a>. Because it's all one system, the reports agree with each other and with reality — you're never reconciling three tools that each tell a slightly different story.</p>

<p>Start with the dashboards that ship today, forecast and plan as more roll out, and let each event teach you how to run the next one better. That's the compounding advantage of measuring the whole thing in one place.</p>

<p>The point of all this isn't a prettier chart — it's better decisions. Knowing that a particular channel drives your ticket sales tells you where to spend next time. Knowing your no-show rate tells you how many to overbook. Knowing where the funnel leaks tells you which single fix earns the most. Measurement only matters if it changes what you do, and because these numbers come from the event you're actually running, they're specific enough to act on rather than a vague industry average.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Measure the whole event, from first click to NPS',
  'Sales, attendance, traffic and sources, email performance and conversion funnels — plus cross-event reporting, real-time dashboards, scheduled reports and surveys.',
  'Start with Geiger Events',
  'Event Analytics & Reporting | Geiger Events',
  'Track event sales, attendance, traffic sources, email performance and conversion funnels with cross-event reporting, real-time dashboards and post-event surveys.',
  array['event analytics','event reporting','ticket sales analytics','event attendance tracking','event dashboards'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
