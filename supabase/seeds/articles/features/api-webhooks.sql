-- feature page: API & Webhooks (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'API & Webhooks',
  'api-webhooks',
  'Connect Geiger Events to the rest of your stack with an API and webhooks — push registrations and orders where they need to go, and react to event activity in real time.',
  $html$<p>No event platform is the only tool a team uses. Registrations need to reach your CRM, orders need to land in your finance system, and a new sign-up might kick off something in a tool the platform has never heard of. An API and webhooks are what turn a closed product into a piece of your actual stack.</p>

<h2>An API for your data</h2>
<p>The API gives you programmatic access to your events, registrations, orders, and attendees, so the data you're collecting isn't trapped behind the dashboard. Pull it into a warehouse, sync it to another system, or build an internal tool on top of it — it's your data, reachable on your terms.</p>

<h2>Webhooks for real-time reactions</h2>
<p>Webhooks push activity out the moment it happens, so another system can react without polling. A new registration, a completed order, a check-in — each can trigger a call to an endpoint you control, letting you post to your team chat, update a record in another system, or start a downstream workflow the instant the event occurs.</p>

<h2>Native automation, too</h2>
<p>Not everything needs code. For reactions that stay inside Geiger Events, <a href="/features/events/event-automation">workflows</a> let you automate follow-ups and internal steps visually — reach for the API and webhooks when you need to cross the boundary into another system, and use workflows when you don't.</p>

<h2>Runs on your team's terms</h2>
<p>API and webhook access sits in your workspace settings alongside team roles and usage, so the people who should manage integrations can, and you can keep an eye on what's connected. It pairs with the rest of the platform — <a href="/features/events/attendee-crm">attendee data</a>, <a href="/features/events/event-ticketing-payments">orders</a>, and <a href="/features/events/event-analytics">analytics</a> — as the programmatic way to move that data where your business needs it.</p>

<h2>What changes for you</h2>
<p>Geiger Events stops being a silo. Your event data flows into the systems that already run your business, other tools react to event activity in real time, and you're not re-keying registrations or exporting CSVs to keep everything in sync. See how it fits your plan on the <a href="/pricing">pricing page</a>.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Connect your events to the rest of your stack',
  'An API and webhooks to move registrations and orders where they belong and react to event activity in real time.',
  'Start with Geiger Events',
  'Event API & Webhooks | Geiger Events',
  'Connect Geiger Events to your stack with an API and webhooks — sync registrations and orders, and react to check-ins and sales in real time.',
  array['event api','event webhooks','event platform integrations','registration api','event data sync'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
