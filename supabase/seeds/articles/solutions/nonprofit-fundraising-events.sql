-- solution page: Nonprofit & Fundraising Events (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Nonprofit & Fundraising Events',
  'nonprofit-fundraising-events',
  'Collect donations and sell tickets from one page, keep more of every dollar with transparent low fees, offer memberships, and remember every supporter in a CRM you own.',
  $html$<p>When you run events for a cause, every dollar has a job to do — and the tools in the middle keep taking a cut of it. You're selling gala tickets, taking donations at the door, and trying to turn one-time givers into recurring supporters, all while a platform quietly skims fees that could have gone to the mission. On top of that, the people who show up to your events are your most valuable supporters, and most tools hand you a payout report and forget them the next day.</p>

<h2>Where fundraising tools quietly cost you</h2>
<p>The friction is money and memory. Ticketing sites take fees you can't fully explain to a board, and every percentage point is program spend that didn't happen. Donations live in a different tool than tickets, so a supporter checks out twice. Memberships and recurring giving need yet another system. And your donor list — the single thing that determines next year's campaign — ends up scattered across exports instead of building into something you own.</p>

<h2>More of every dollar, and every supporter remembered</h2>
<p>Geiger Events puts tickets, donations, and memberships on one page, keeps fees transparent and low so more reaches the cause, and holds every supporter in a CRM that's yours.</p>

<h3>Tickets and donations, one checkout</h3>
<p>Sell tickets to a gala, a run, or a dinner and collect donations in the same flow through <a href="/features/events/event-ticketing-payments">ticketing and payments</a> powered by Stripe. Supporters give and register in one place instead of two. Fees are transparent and kept low — which for a nonprofit is the whole point — with the real numbers on the <a href="/pricing">pricing page</a> so you can show a board exactly what reaches the mission.</p>

<h3>Turn givers into members</h3>
<p>Offer <a href="/features/events/memberships">memberships</a> that unlock supporter pricing and access, so a one-time attendee becomes recurring support instead of a name you have to re-earn every campaign. Membership becomes a relationship, not a transaction.</p>

<h3>A page that carries the cause</h3>
<p>Build an event page that tells the story — cover media, the why, location and time — with the <a href="/features/events/event-page-builder">visual page builder</a>, on a clean URL you can put in an appeal email or a social post. It looks like your organization, not a generic checkout.</p>

<h3>A donor list you own</h3>
<p>Every attendee, donor, and member lands in your <a href="/features/events/attendee-crm">supporter CRM</a> — a real contact book you control, ready to segment for stewardship, invite to the next event, or thank. Reach them with appeals and reminders over <a href="/features/events/event-email-sms-marketing">email and SMS</a> so attendance holds and giving compounds.</p>

<h2>What changes</h2>
<p>The mission keeps more of what you raise, and your supporters stop slipping through the cracks between tools. Tickets and donations flow through one page, members give year-round, and your donor list becomes an asset that grows with every event instead of an export you lose. The overhead shrinks and the impact is easier to show.</p>

<blockquote>For nonprofits and fundraisers who want tickets, donations, and memberships on one page, transparent low fees so more reaches the cause, and a supporter CRM they own.</blockquote>

<p>See exactly what reaches your mission on the <a href="/pricing">pricing page</a>, or set up your first fundraising event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'More of every dollar reaches the cause',
  'Tickets, donations, and memberships on one page, transparent low fees, and a supporter CRM you own.',
  'Start with Geiger Events',
  'Nonprofit & Fundraising Event Software | Geiger Events',
  'Collect donations and sell tickets on one page, offer memberships, keep more with transparent low fees, and remember every supporter in a CRM you own.',
  array['nonprofit event software','fundraising event platform','donation ticketing','charity event registration','nonprofit crm'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
