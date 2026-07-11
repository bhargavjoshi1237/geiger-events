-- feature page: Dynamic Ticket Pricing (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Dynamic Ticket Pricing',
  'dynamic-ticket-pricing',
  'Let ticket prices respond to demand as your event fills, so early buyers get a deal and you capture more as the room sells out — an enterprise-grade control at creator-friendly fees.',
  $html$<p>Flat pricing leaves money on both ends. Set the price too low and you undersell a room that would have paid more; set it too high and the early momentum never starts. Dynamic pricing lets a ticket's price move with demand, so the first buyers are rewarded and the price rises as the event fills — the pricing strategy big venues have used for years, without the enterprise contract.</p>

<h2>Pricing that moves with demand</h2>
<p>Instead of one fixed number, dynamic pricing responds to how fast tickets are selling. Early on, prices sit low to reward the people who commit first and build the social proof that pulls everyone else in. As inventory sells through, prices step up toward what the room will actually bear. You set the strategy; the system applies it as sales happen.</p>

<h2>Why it works</h2>
<p>Demand-based pricing does two jobs at once. It creates urgency — "the price only goes up from here" is a real, honest reason to buy now — and it captures the full value of a high-demand event instead of selling out in an hour at a price you later regret. For organizers who run the same event repeatedly, it's a way to learn what your audience is willing to pay without guessing.</p>

<h3>An enterprise control, minus the enterprise price</h3>
<p>Dynamic pricing normally lives behind a "contact sales" wall on large ticketing suites. In Geiger Events it's part of the standard <a href="/features/events/event-ticketing-payments">ticketing</a> toolkit, available to any organizer at the same transparent, low fees — see the <a href="/pricing">pricing page</a> for how those work.</p>

<h2>Use it alongside your other pricing levers</h2>
<p>Dynamic pricing pairs with the rest of the ticketing system rather than replacing it. Run an <a href="/features/events/discount-codes-promo">early-bird tier or discount codes</a> for specific audiences, keep some tiers at a fixed price, and let your general admission float with demand. For high-demand on-sales, combine it with <a href="/features/events/anti-scalping-resale">anti-scalping rules</a> so the value you're capturing goes to you, not to resellers.</p>

<h2>What changes for you</h2>
<p>You stop leaving revenue on the table. Early buyers feel rewarded, late buyers feel the urgency, and the price of every event reflects what it was actually worth — all handled automatically as tickets sell, through the same checkout your buyers already trust.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Price your tickets to match demand',
  'Reward early buyers with lower prices and capture more as the room fills — an enterprise pricing control at creator-friendly fees.',
  'Start with Geiger Events',
  'Dynamic Ticket Pricing for Events | Geiger Events',
  'Let ticket prices respond to demand as your event sells — reward early buyers, capture more at the peak. Enterprise-grade pricing without the enterprise contract.',
  array['dynamic ticket pricing','demand based ticket pricing','surge pricing tickets','event pricing strategy','variable ticket pricing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
