-- solution page: Membership Organizations & Associations (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Membership Organizations & Associations',
  'membership-organizations',
  'Sell membership plans, gate registration and pricing to members, run your recurring calendar without rebuilding it, and keep your whole roster in one CRM.',
  $html$<p>Running a membership organization means the events and the members are the same problem. Members expect a full calendar — monthly meetings, socials, an annual thing — and they expect their membership to actually mean something when they register: their spot, their price, member-only access. But most event tools treat every event as a stranger walking up to buy a ticket. They don't know who's a member, they can't gate a registration, and they force you to rebuild the same recurring meeting from scratch every single month.</p>

<h2>Why generic event tools fight a membership</h2>
<p>The mismatch is structural. A ticketing site has no concept of "member," so member pricing becomes an honor-system code you police by hand. It can't restrict a registration to current members, so member-only events leak to anyone with the link. It has no memory of your recurring calendar, so your admin re-creates the monthly meeting twelve times a year. And your member list lives in one system while your event attendance lives in another, so you never quite know who's active and who's drifting.</p>

<h2>Members and events, finally in one system</h2>
<p>Geiger Events treats membership as the layer underneath your calendar: plans people join, registration and pricing that recognize them, a recurring schedule that builds itself, and one roster that ties it all together.</p>

<h3>Plans people actually join</h3>
<p>Sell <a href="/features/events/memberships">membership plans</a> that unlock member pricing and access, collected through Stripe. Membership becomes a real record on a person, not a spreadsheet flag — so the system knows who's current and who's lapsed without you checking.</p>

<h3>Registration that knows who's a member</h3>
<p>Gate <a href="/features/events/event-registration-rsvp">registration</a> so member-only events are actually member-only, and members get their pricing automatically at checkout instead of hunting for a code. The right people get the right access without you standing at the gate.</p>

<h3>A calendar that builds itself</h3>
<p>Set your monthly meeting or recurring social up once as an <a href="/features/events/event-series-recurring">event series</a>, and each edition inherits the last — page, settings, and access — so your admin stops rebuilding the same event on a loop. Save your common formats as <a href="/features/events/event-templates">templates</a> for one-click new events.</p>

<h3>One roster, always current</h3>
<p>Members, guests, and attendees all live in one <a href="/features/events/attendee-crm">CRM</a>, so you can see who's active, who came to what, and who's slipping away — then reach them with renewals, invites, and reminders over <a href="/features/events/event-email-sms-marketing">email and SMS</a>. Retention becomes something you can see and act on, not guess at.</p>

<h2>What changes</h2>
<p>Your membership and your events stop being two disconnected systems. Members get recognized the moment they register, member-only stays member-only, the recurring calendar runs itself, and one roster tells you the truth about who's engaged. Your admin gets their month back and your members feel like membership means something.</p>

<blockquote>For membership orgs, clubs, and associations that need member plans, member-gated registration, a self-building recurring calendar, and one roster tying members to events.</blockquote>

<p>See how plans and fees work on the <a href="/pricing">pricing page</a>, or set up your membership and calendar today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Members and events, finally in one system',
  'Membership plans, member-gated registration and pricing, a self-building recurring calendar, and one roster.',
  'Start with Geiger Events',
  'Membership Organization & Association Software | Geiger Events',
  'Sell membership plans, gate registration and pricing to members, run recurring events without rebuilding them, and keep your whole roster in one CRM.',
  array['membership organization software','association event management','member-only registration','recurring events','membership crm'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
