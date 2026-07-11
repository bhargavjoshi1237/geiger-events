-- feature page: Event Automation & Workflows (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Event Automation & Workflows',
  'event-automation',
  'Build automations that fire when something happens at your event — a ticket bought, an attendee checked in — with a step list, a drag-and-drop canvas, starter templates, and full run history.',
  $html$<p>Running an event is a thousand small "when this, then that" moments: a ticket sells, so send a welcome; someone checks in, so tag them; a VIP registers, so alert the team. Do those by hand and they eat your attention on the day you have least of it. Workflows in Geiger Events let you set them up once and let the system carry them out — every time, without you watching.</p>

<h2>When something happens, do something</h2>
<p>Every workflow starts with a trigger — an action in your event like a ticket being purchased or an attendee checking in — and runs the steps you attach to it. Scope a workflow to a single event when it's specific, or to your whole workspace when it should apply across everything you run. Give it a name, pick the trigger, and you have an automation listening for the moment it's built for.</p>

<h3>Two ways to build the same flow</h3>
<p>The builder meets you where you think. Lay out an automation as a linear step list when the logic is a straight sequence, or switch to a drag-and-drop node canvas when it branches and you want to see the shape of it. It's the same workflow either way — the two views are just different lenses on the conditions and actions you're assembling, so you're never forced into a mental model that doesn't fit the task.</p>

<h2>Start from a template</h2>
<p>You don't have to build from a blank canvas. A curated gallery of workflow templates covers the automations most organizers reach for, and using one mints a ready-made workflow you can tailor and turn on. It's the fastest way to get a proven automation running — start from the pattern, adjust the details, activate.</p>

<h3>Draft, activate, pause</h3>
<p>New workflows begin as drafts, so you can build and review before anything fires. Activate one and it starts listening for its trigger; pause it and it stops without being deleted, ready to switch back on. That lifecycle means you can stage automations ahead of an event and flip them live exactly when you want them.</p>

<h2>See every run</h2>
<p>Automation you can't inspect is automation you can't trust. Run History logs each time a workflow executes, so you can confirm the welcome email actually went out when that ticket sold, and trace what happened if something looks off. Every workflow also carries its own run count, giving you an at-a-glance sense of what's doing the heavy lifting and what's never firing.</p>

<h2>Wired into the whole platform</h2>
<p>Workflows are only as useful as what they can act on, and here they sit on top of everything else. A trigger can come from ticketing when a purchase completes or from <a href="/features/events/event-check-in-app">check-in</a> when someone arrives, and the people it touches live in your <a href="/features/events/attendee-crm">attendee CRM</a>. Automate a member's welcome the moment they join a membership, or a VIP's the moment they buy — the automation reaches across the product because the data does too.</p>

<p>For how the surrounding pieces fit — tickets, check-in, contacts — start with the <a href="/features/events/event-ticketing-payments">ticketing page</a>, and see what's included on each plan on the <a href="/pricing">pricing page</a>.</p>

<h2>Why it matters</h2>
<p>The manual version of event operations doesn't scale and doesn't sleep — it depends on someone remembering to do the right thing at the right moment. Workflows move that reliability into the system: the follow-up fires whether or not you're looking, the tag gets applied every time, and the run history proves it happened. That's fewer dropped balls on the day, and more of your attention left for the event itself.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Set it up once, let it run',
  'Build automations that fire on ticket purchases, check-ins, and more — with a step list, a drag-and-drop canvas, templates, and full run history.',
  'Start with Geiger Events',
  'Event Automation & Workflow Software | Geiger Events',
  'Build event automations with a step list and drag-and-drop canvas, start from curated templates, and inspect every run in a full history log. Triggered by real event actions.',
  array['event automation software','event workflows','marketing automation for events','workflow builder','automated event reminders'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
