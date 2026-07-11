-- feature page: Anti-scalping & Controlled Resale (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Anti-scalping & Controlled Resale',
  'anti-scalping-resale',
  'Bind tickets to the buyer, control or disable transfers, cap resale at face value, and check identity at the door — keep bots and gougers out of your on-sale.',
  $html$<p>A hot on-sale attracts the wrong buyers. Bots sweep inventory, resellers list your tickets at a markup, and real fans either pay double or miss out — and it's your event's name attached to the bad experience. Anti-scalping and controlled resale give you the levers to keep tickets in the hands of the people you're selling to.</p>

<h2>Rules you set per event</h2>
<p>Anti-scalping is a reusable rule set you opt an event into, so you can be strict on a high-demand show and relaxed on a casual one.</p>

<h3>Name-locked tickets</h3>
<p>Bind a ticket to the buyer's name so it can't be quietly handed off or flipped. The name on the ticket is the name that gets in.</p>

<h3>Transfer policy you choose</h3>
<p>Decide how tickets can move: no transfers at all, transfers only with your approval, or open transfers when you want flexibility. You set the policy that fits the event instead of accepting whatever the platform allows.</p>

<h3>Resale capped at face value</h3>
<p>When resale is allowed, cap it at face value so a ticket can change hands without becoming a profit engine for scalpers. Fans who genuinely can't attend can pass their ticket on; nobody turns your event into a markup.</p>

<h3>Identity check at entry</h3>
<p>For the strictest events, require an identity check at the door so the person entering matches the ticket. Combined with name-lock and a per-buyer purchase cap, it closes the loop from checkout to entry.</p>

<h2>Part of the ticketing system, not a bolt-on</h2>
<p>These controls live inside <a href="/features/events/event-ticketing-payments">ticketing</a>, so a protected ticket is still a normal ticket — it carries a QR code, lands in your <a href="/features/events/attendee-crm">attendee list</a>, and scans through the <a href="/features/events/event-check-in-app">check-in app</a>, where the name and identity rules are enforced. For assigned-seat shows, pair it with <a href="/features/events/reserved-seating">reserved seating</a> so specific seats can't be flipped either.</p>

<h2>What changes for you</h2>
<p>Your on-sale goes to fans, not bots. Resale happens on your terms, at a price you set, through channels you control — and the door has the final say. The event keeps its reputation, and the value you built stays with you and your audience. See how it fits your plan on the <a href="/pricing">pricing page</a>.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Keep your tickets out of scalpers'' hands',
  'Name-lock tickets, control transfers, cap resale at face value, and verify identity at the door — protection you configure per event.',
  'Start with Geiger Events',
  'Anti-scalping & Controlled Resale Ticketing | Geiger Events',
  'Bind tickets to buyers, control transfers, cap resale at face value, and check ID at entry. Keep bots and scalpers out of your event on-sale.',
  array['anti-scalping ticketing','controlled ticket resale','name locked tickets','stop ticket scalping','face value resale'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
