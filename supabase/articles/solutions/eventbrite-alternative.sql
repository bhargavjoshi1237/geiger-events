-- solution page: Eventbrite Alternative (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'The Eventbrite Alternative for Organizers',
  'eventbrite-alternative',
  'Keep more of every sale with transparent, lower fees, put your event on a page that looks like yours, and build a follower list that fills the next date — instead of feeding a marketplace.',
  $html$<p>You picked a big-name ticketing platform because it was the obvious default, and it got you selling. But somewhere between the fee line on every order and the event page that looks exactly like ten thousand others, it started to feel like you were building someone else's business. The fees are hard to predict and take a bite you feel on every ticket. The page carries the platform's brand more than yours. And the audience you worked to build isn't really yours — it's the marketplace's, rented back to you one event at a time.</p>

<h2>The three costs organizers actually feel</h2>
<p>The frustration usually comes down to three things. First, <strong>fees</strong> — opaque, layered, and higher than you'd like, eating margin you'd rather keep or pass to attendees. Second, <strong>generic pages</strong> — a templated listing that makes your event look like every other listing, when the page is often the first impression a buyer gets. Third, <strong>a borrowed audience</strong> — your attendees flow into a directory, not a relationship you own, so every event starts closer to zero than it should.</p>

<h2>An alternative that treats it like your business</h2>
<p>Geiger Events is built on the opposite premise: the event, the page, the fees, and the audience should all work in your favor.</p>

<h3>Transparent, lower fees</h3>
<p>Fees are kept low and stated plainly, so you can see what you'll pay and keep more of every sale. We don't publish a number here that could go stale — the current, specific pricing lives on the <a href="/pricing">pricing page</a>, laid out so there are no surprises on the order summary. Payments run on Stripe, the same trusted rails you already know, so lower cost doesn't mean a sketchier checkout.</p>

<h3>Pages that look like yours</h3>
<p>Build an event page with real cover media, a rich description, and a custom URL using the <a href="/features/events/event-page-builder">visual page builder</a> — a page that represents your brand instead of a marketplace's template. The first impression a buyer gets is your event, not a directory listing surrounded by competitors.</p>

<h3>Ticketing with real depth</h3>
<p>Underneath the nicer page is <a href="/features/events/event-ticketing-payments">ticketing</a> that does the serious work: tiers, early-bird windows, discount codes, group orders, and access codes. Free RSVPs and paid tickets run from the same flow, so you're not bolting a second tool on the moment you start charging.</p>

<h3>An audience you actually own</h3>
<p>This is the real difference. Everyone who registers lands in your <a href="/features/events/attendee-crm">attendee CRM</a> as a contact you own, and an organizer profile lets people follow you directly. Instead of renting reach from a marketplace each time, you build a following that carries from one event to the next — a "who's going" list adds social proof, and your follower base does the marketing for your next date. Over a year of events, an owned audience compounds; a borrowed one resets.</p>

<h2>Switching without losing a step</h2>
<p>The move is easier than it looks because the fundamentals are familiar — sell tickets, scan people in — just with more of the value staying on your side. The <a href="/features/events/event-check-in-app">check-in app</a> scans QR tickets, works offline when venue Wi-Fi drops, and shows live attendance, so the door runs at least as smoothly as what you're leaving. For organizers who run a series, a growing follower list and reusable event setup mean each new date launches faster than the last.</p>

<h2>What changes when you own the stack</h2>
<p>You keep more of every sale because fees are lower and legible. Your events look like your brand because the page is yours. And your audience compounds because contacts and followers belong to you, not a directory you pay to appear in. The default was convenient, but convenient was quietly building someone else's asset. This builds yours.</p>

<blockquote>Built for organizers leaving a marketplace who want lower, transparent fees, pages that look like their brand, and an audience they actually own.</blockquote>

<p>Compare the fees for yourself on the <a href="/pricing">pricing page</a>, or start building your first event today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Stop building someone else''s marketplace',
  'Transparent, lower fees, pages that look like your brand, and an audience you actually own — not one you rent back one event at a time.',
  'Start with Geiger Events',
  'Eventbrite Alternative for Organizers | Geiger Events',
  'A transparent, lower-fee Eventbrite alternative: pages that look like your brand, deep ticketing, and an audience you own instead of rent. Compare on pricing.',
  array['eventbrite alternative','event ticketing platform','lower ticketing fees','event ticketing software','sell tickets online'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
