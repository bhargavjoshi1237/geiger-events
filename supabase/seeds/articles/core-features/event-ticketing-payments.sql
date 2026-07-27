-- feature page: Event Ticketing & Payments (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Event Ticketing & Payments',
  'event-ticketing-payments',
  'Sell tickets online with tiers, early-bird pricing, discount codes, bundles, payment plans and payouts — plus reserved seating and anti-scalping usually locked inside enterprise suites.',
  $html$<p>Selling tickets should be the easy part of running a paid event, but most platforms make you choose: a simple tool that stops at flat-price tickets, or an enterprise suite that charges like one. Geiger Events covers the full ticketing lifecycle — how you price, how you sell, how you get paid, and how you handle the messy parts afterward — with transparent, creator-friendly fees.</p>

<h2>Flexible ticket types for any event</h2>
<p>Create free tickets, paid tickets, and any number of <a href="/features/events/reserved-seating">tiers</a> — General, VIP, Platinum — grouped and ordered the way you want. Bundle several ticket types together for a package price, or add on extras like a workshop or dinner. Whether it's a five-dollar class or a multi-day conference with a VIP track, you model it once and it just works.</p>

<h3>Timed and early-bird sales</h3>
<p>Reward the first buyers with early-bird pricing that closes on a date or after a set number of sales, then moves to standard pricing automatically. Schedule when tickets go on sale and when they stop, so a launch runs on its own.</p>

<h2>Sell more with smart pricing</h2>
<h3>Discount codes and coupons</h3>
<p>Generate <a href="/features/events/discount-codes-promo">promo codes</a> for sponsors, partners, or a social push. The discount applies at checkout — no spreadsheets, no manual math.</p>

<h3>Group purchasing and access-code tickets</h3>
<p>Offer group rates for teams buying together, and gate private tickets behind an access code so only the people you invite can buy them.</p>

<h3>Dynamic pricing</h3>
<p>With <a href="/features/events/dynamic-ticket-pricing">demand-based pricing</a>, ticket prices can respond as an event fills — an advanced control that normally sits behind an enterprise contract, available here at the same low-fee rate.</p>

<h2>Get paid, your way</h2>
<p>Accept cards and digital wallets through a checkout that feels native on any device, powered by Stripe. Sell internationally with <a href="/features/events/anti-scalping-resale">multi-currency</a> support, and let higher-priced tickets be split into installments with payment plans, so attendees can secure a spot now and pay over time.</p>

<h3>Payouts, taxes, and invoicing</h3>
<p>Payouts settle to your account, taxes are handled at checkout, and invoices and receipts are generated automatically — no manual email threads. For exactly how fees and payouts work, see the <a href="/pricing">pricing page</a>; we keep them transparent and lower than the big incumbents, and we show them to you and your buyer up front.</p>

<h2>Handle the messy parts automatically</h2>
<p>Refund requests, ticket transfers, and receipts run through the system instead of your inbox. Every order, attendee, and payment status lives on one dashboard, so you always know who's coming and what you've earned without exporting a CSV.</p>

<h2>Protect your event</h2>
<p>For high-demand events, <a href="/features/events/anti-scalping-resale">anti-scalping rules</a> can bind a ticket to the buyer's name, cap or disable resale, and require an identity check at entry — keeping bots and gougers out. <a href="/features/events/reserved-seating">Reserved seating</a> lets attendees pick their exact seat at purchase, ideal for theaters, clubs, and banquet rooms, with no enterprise add-on.</p>

<h2>Transparent, lower fees</h2>
<p>The whole point is that you keep more of every sale. Fees are simple, shown clearly to both organizer and buyer, and lower than platforms like Eventbrite for the small paid events most organizers actually run. See the current numbers and a fee comparison on the <a href="/pricing">pricing page</a>.</p>

<p>Ticketing works hand in hand with <a href="/features/events/event-registration-rsvp">registration</a>, <a href="/features/events/event-check-in-app">check-in</a>, and your <a href="/features/events/attendee-crm">attendee CRM</a>, so a buyer flows from checkout to the door to your follower list without a seam.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Sell tickets online, keep more of every sale',
  'The full ticketing lifecycle — tiers, early-bird, discounts, payouts, refunds — plus reserved seating and anti-scalping, at transparent creator-friendly fees.',
  'Start with Geiger Events',
  'Event Ticketing Software with Low Fees | Geiger Events',
  'Sell tickets online with tiers, early-bird pricing, discount codes, and payouts — plus reserved seating and anti-scalping. Transparent fees, no enterprise contract.',
  array['event ticketing software','sell tickets online','online ticketing platform','ticket tiers','low fee ticketing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
