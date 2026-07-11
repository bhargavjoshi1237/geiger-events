-- feature page: Event Pages & Visual Builder (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Event Pages & Visual Builder',
  'event-page-builder',
  'Build a public event page with cover media, a rich description, location and date, a custom URL, drag-and-drop blocks, themes and templates — then publish it public or keep it private.',
  $html$<p>Your event page is the first thing an attendee sees and the last thing standing between interest and a ticket. It should look like it belongs to you, load fast, and answer every question before someone has to ask. Geiger Events gives you a visual builder to make that page — no designer, no separate website tool, no code — and it connects straight to the rest of your event, from registration to the door.</p>

<h2>Everything a great event page needs</h2>
<p>Start with the essentials and layer on the rest. Add cover media, write a rich description with formatting, and set the location, date, and start and end times. The page keeps the practical details front and center so an attendee can decide in seconds whether they're in.</p>

<h3>Cover media and rich description</h3>
<p>Lead with a cover image or video, then tell the full story underneath — agenda, what's included, who it's for, how to get there. The description editor supports headings, lists, and emphasis so a long event reads cleanly instead of as a wall of text.</p>

<h3>Location, date, and time</h3>
<p>Set a venue and the exact schedule, and the page presents them clearly with a map and the local time. Pull a saved venue and the location fills itself in, so the same address you use across events stays consistent.</p>

<h2>Design it without touching code</h2>
<p>The builder is block-based. Add, reorder, and remove sections — hero, description, schedule, location, and more — by arranging blocks on the page instead of editing markup. Every change previews live, so you shape the layout the way you want and see it exactly as your audience will.</p>

<h3>Themes and page design</h3>
<p>Control the look with theme controls: colors, typography, and spacing that carry your brand across the whole page. Set it once and the page reads as yours rather than as a generic template, whether it's a warm community meetup or a sharp corporate summit.</p>

<h3>Templates to start fast</h3>
<p>Don't start from a blank canvas. Begin from a template, adjust the copy and theme, and you have a polished page in minutes. Reuse the same structure across events so your pages stay recognizable and on-brand from one to the next.</p>

<h2>Your own URL and visibility</h2>
<p>Give the page a custom URL so the link you share is clean and memorable instead of a string of random characters. When you're ready, publish it public for anyone to find, or keep it private and share the link only with the people you invite — useful for members-only nights, internal events, or a soft launch before you announce.</p>

<h3>Public or private, your call</h3>
<p>Visibility is a switch, not a rebuild. Keep an event unlisted while you finalize details, then flip it public the moment you're ready to sell. Private pages still work end to end for the people who have the link, so nothing about the experience changes — only who can reach it.</p>

<h2>Connected to the rest of your event</h2>
<p>A page in isolation is just a poster. Here it's the front door to a working system. Wire in <a href="/features/events/event-registration-rsvp">registration and RSVP</a> so attendees sign up right on the page, or attach <a href="/features/events/event-ticketing-payments">ticketing</a> so they can buy without leaving. Everyone who signs up flows into your <a href="/features/events/attendee-crm">attendee CRM</a>, and every visit and conversion shows up in <a href="/features/events/event-analytics">analytics</a> so you can see which channels actually bring people in.</p>

<h2>One page, from first draft to sold out</h2>
<p>Because the page, the registration form, the ticket checkout, and the attendee list are all one product, you never stitch tools together or copy data between them. You build the page, publish it, share the link, and watch sign-ups arrive — then use the same event to run check-in at the door. It's the difference between a marketing page that looks nice and an event page that does the work.</p>

<p>Whether you're announcing a single workshop or a recurring series, the builder scales with you: quick and template-driven when you need speed, fully custom when the event deserves it. Start simple, publish, and refine as you go — you can keep editing a live page and your changes appear the moment you save, so you're never locked into the first version.</p>

<p>And because the page reflects your live event, the details stay honest on their own. Change a date, add a ticket type, or hit capacity, and the page keeps pace without a second edit. That's what separates a real event page from a static poster you have to remember to update: it's connected to the thing it's selling.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Build an event page that sells, no code required',
  'Cover media, rich descriptions, drag-and-drop blocks, themes, templates and a custom URL — with registration, ticketing and check-in built in.',
  'Start with Geiger Events',
  'Event Page Builder | Geiger Events',
  'Build a public event page with a visual drag-and-drop builder — cover media, rich description, themes, templates, a custom URL, and public or private visibility.',
  array['event page builder','event website builder','event landing page','custom event url','event page templates'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
