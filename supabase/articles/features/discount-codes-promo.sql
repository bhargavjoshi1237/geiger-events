-- feature page: Discount Codes & Coupons (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Discount Codes & Coupons',
  'discount-codes-promo',
  'Create promo codes, early-bird pricing, group rates, and private access codes that apply automatically at checkout — drive sales without spreadsheets or manual math.',
  $html$<p>Discounts are how you reward the right people at the right time — early supporters, partner audiences, groups, members — but only if they're effortless to run. Bolted-on coupon tools mean tracking codes in a spreadsheet and reconciling by hand. In Geiger Events, discounts are part of <a href="/features/events/event-ticketing-payments">ticketing</a>, so a code just works at checkout and the numbers reconcile themselves.</p>

<h2>Promo codes and coupons</h2>
<p>Generate discount codes for a social push, a sponsor, an alumni list, or a partner newsletter. The buyer enters the code and the discount applies at checkout — no manual price edits, no chasing who used what. Every redemption ties back to the order, so you can see which codes actually drove sales.</p>

<h2>Early-bird pricing</h2>
<p>Reward the people who commit first with early-bird pricing that closes on a date or after a set number of tickets, then rolls to standard pricing on its own. It's the simplest, most honest urgency there is: the price really does go up. You can choose whether early-bird stacks with other discounts.</p>

<h2>Group rates</h2>
<p>Offer a lower per-ticket price when people buy together above a threshold — the natural fit for teams, crews, and friend groups. Set the minimum group size and the discount, and let buyers self-serve the group rate at checkout instead of emailing you for a deal.</p>

<h2>Private access codes</h2>
<p>Not every discount should be public. Gate a hidden ticket behind an access code so only the people you invite — members, VIPs, a pre-sale list — can even see or buy it. It's a discount and an exclusivity lever in one.</p>

<h2>All in one checkout</h2>
<p>Because these live inside the ticketing engine, they compose. An early-bird tier can carry a promo code, a members list can get a private access code, and a group can buy at a group rate — all through the same checkout, all reconciled on the same <a href="/features/events/attendee-crm">orders and attendees</a> dashboard. Pair discounts with <a href="/features/events/event-email-sms-marketing">email and SMS campaigns</a> to get the codes in front of the right segment.</p>

<h2>What changes for you</h2>
<p>You run promotions without the overhead. Codes apply themselves, early-bird and group logic run automatically, private sales stay private, and you can finally see which discount moved the needle. For how fees work on discounted tickets, see the <a href="/pricing">pricing page</a>.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Run discounts that reconcile themselves',
  'Promo codes, early-bird pricing, group rates, and private access codes that apply at checkout — no spreadsheets, no manual math.',
  'Start with Geiger Events',
  'Discount Codes & Coupons for Events | Geiger Events',
  'Create promo codes, early-bird pricing, group rates, and private access codes that apply automatically at checkout. Drive event sales without the spreadsheets.',
  array['discount codes for events','event coupons','early bird tickets','group ticket rates','promo codes ticketing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
