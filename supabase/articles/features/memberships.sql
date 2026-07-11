-- feature page: Memberships & Recurring Access (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Memberships & Recurring Access',
  'memberships',
  'Sell membership plans — one-time, monthly, or yearly — that unlock member discounts, member-only registration, and a managed roster, with public join and auto-renew.',
  $html$<p>The best events aren't one-offs — they're a room of people who keep coming back. A membership turns that loyalty into something structural: recurring revenue you can plan around, and an audience that has a reason to show up again. Geiger Events builds memberships in as a first-class part of the platform, so you can offer plans, reward members with better pricing and access, and manage who belongs from one roster.</p>

<h2>Plans on your terms</h2>
<p>Create membership plans as reusable records, each with its own price, billing period, and benefits. Charge one time for a lifetime tier, monthly for an ongoing club, or yearly for an annual pass — the billing period is yours to set per plan. Spell out what each membership includes as a simple list of benefits, add a description for prospective members, and you have a tier ready to attach to events.</p>

<h3>Member discounts on tickets</h3>
<p>The clearest reason to join is a better price. Each plan can carry a member discount that applies to ticket prices, so members automatically pay less than the general public. It's the perk that pays for itself — the discount is the reason someone becomes a member, and the membership is the reason they keep coming back. For how ticket pricing and checkout work, see the <a href="/features/events/event-ticketing-payments">ticketing page</a>, and the <a href="/pricing">pricing page</a> for plan details.</p>

<h2>Member-only access</h2>
<p>Discounts reward members; exclusivity defines them. Gate registration so certain events — or certain tickets — are open only to members, turning your membership into the key that unlocks the room. Combined with member pricing, that gives you two levers: pay less as a member, and get in where others can't.</p>

<h3>A roster you can manage</h3>
<p>Everyone who joins lands on the Members roster, your single view of who currently belongs. Because members are real records tied to your project, they connect to the rest of your audience data in the <a href="/features/events/attendee-crm">attendee CRM</a>, so a member's history — what they've joined, what they've attended — stays in one place.</p>

<h2>Let people join, and keep them</h2>
<p>Turn on public join and people can buy a membership straight from your public event pages — no manual enrollment, no back-and-forth. Turn on auto-renew and memberships renew automatically at the end of each period, so recurring plans actually recur instead of quietly lapsing. You enable memberships once for the project from Membership Settings, then build the plans themselves and attach them where they apply.</p>

<h3>Automate the member lifecycle</h3>
<p>Membership works even better when the follow-through runs itself. Pair it with <a href="/features/events/event-automation">workflows</a> to welcome a new member the moment they join, or nudge one whose renewal is coming up — the recurring relationship handled without a manual checklist.</p>

<h2>Why it matters</h2>
<p>One-time ticket sales reset to zero after every event. A membership base doesn't — it's a floor of committed attendees and predictable revenue that makes the next event easier to fill and easier to plan. For community organizers, creators, clubs, and associations, memberships are how an audience stops being a fresh crowd each time and becomes a base you can count on.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Turn attendees into members',
  'Sell membership plans that unlock member discounts, member-only access, and auto-renewing recurring revenue.',
  'Start with Geiger Events',
  'Event Membership Software | Geiger Events',
  'Sell one-time, monthly, or yearly membership plans with member ticket discounts, member-only registration, public join, and auto-renew — plus a managed member roster.',
  array['event membership software','membership plans','recurring memberships','member discounts','member-only events'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
