-- feature page: Email & SMS Campaigns (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Email & SMS Campaigns',
  'event-email-sms-marketing',
  'Send newsletters, email, SMS and WhatsApp invites, text blasts and automated reminders — with a template builder, drip sequences, segmentation, scheduling, personalization, A/B testing and deliverability.',
  $html$<p>Filling a room takes more than publishing a page and hoping. You have to invite the right people, remind them, and follow up — across the channels they actually read. Geiger Events puts email and SMS marketing inside the same platform as your event, so you message the exact audience you built without exporting a list to some outside tool that has no idea who's already coming.</p>

<h2>Reach people where they are</h2>
<h3>Email, SMS, and WhatsApp invites</h3>
<p>Send invites over email, SMS, and WhatsApp — pick the channel that fits the audience and the moment. A polished email for the announcement, a quick text for the day-of nudge, a WhatsApp message for the community that lives there. Same event, same contacts, whichever channel lands.</p>

<h3>Newsletters and text blasts</h3>
<p>Keep your audience warm between events with newsletters, and cut through the noise when it counts with a text blast that goes straight to the phone. A blast is how you fill last-minute seats or push an urgent change; a newsletter is how you keep people paying attention until the next event.</p>

<h2>Send at the right moment, automatically</h2>
<h3>Automated reminders</h3>
<p>Registered isn't the same as showing up. Automated reminders go out on their own as the date approaches, so attendance doesn't hinge on you remembering to send the "it's tomorrow" message. Set it once and every attendee gets the nudge.</p>

<h3>Drip sequences and send scheduling</h3>
<p>Build a sequence that runs itself — an invite, a follow-up for non-openers, a reminder, a thank-you — and let it play out over days without manual sends. Schedule any message for the time your audience is most likely to open it, in their moment rather than yours.</p>

<h2>The right message to the right people</h2>
<h3>Segmentation and personalization</h3>
<p>Target the <a href="/features/events/attendee-crm">segments</a> you built in your contact book — VIPs, first-timers, people who haven't registered yet — so nobody gets a message meant for someone else. Personalize each send with the recipient's own details so it reads like a note, not a broadcast. Relevant messages get opened; generic ones get ignored.</p>

<h3>Email template builder</h3>
<p>Design on-brand emails with the template builder instead of wrestling with raw formatting. Build a look once, reuse it across campaigns, and keep every message recognizably yours — no separate design tool, no copy-pasting HTML.</p>

<h2>Send smarter, land in the inbox</h2>
<h3>A/B testing</h3>
<p>Not sure which subject line or approach wins? Test variants against each other with A/B testing and let the results decide, so your next send is better than a guess. Small improvements to open rates compound across every campaign you run.</p>

<h3>Deliverability</h3>
<p>A message that lands in spam might as well not exist. Deliverability tooling helps your sends actually reach the inbox, so the effort you put into the copy and the timing isn't wasted at the last step. Getting seen is half the battle, and it's the half most tools ignore.</p>

<h2>Marketing that knows your event</h2>
<p>The reason this beats a bolted-on email tool is that it already knows everything. Your audience comes from the same <a href="/features/events/attendee-crm">attendee CRM</a>, your <a href="/features/events/event-registration-rsvp">registrations</a> update who's in and who to chase, and campaign results flow back into <a href="/features/events/event-analytics">analytics</a> next to sales and attendance — so you can see which message actually drove sign-ups, not just who opened it. There's no syncing, no stale list, no wondering whether the person you're inviting already bought a ticket.</p>

<p>From the first save-the-date to the post-event thank-you, every message runs on the live state of your event. You invite, remind, and follow up across email, SMS, and WhatsApp; you segment and personalize; you schedule, sequence, test, and land in the inbox — all without leaving the platform that's running the event itself.</p>

<p>Start with a simple invite, add reminders, then build the full sequence as your audience grows. The tools scale from a single blast to a multi-channel campaign without changing where you work.</p>

<p>The advantage compounds over time. Because every send is tied to your contacts and your events, the platform gets smarter about your audience with each campaign — who opens, who buys, who needs a nudge — and you spend less effort reaching more of the right people. That's marketing that works with the event instead of alongside it, and it's why a message sent from here tends to convert better than the same message sent from a disconnected list.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Fill the room with email and SMS that convert',
  'Newsletters, email, SMS and WhatsApp invites, automated reminders and blasts — with a template builder, drip sequences, segmentation, scheduling, personalization and A/B testing.',
  'Start with Geiger Events',
  'Event Email & SMS Marketing | Geiger Events',
  'Send event newsletters, email, SMS and WhatsApp invites, reminders and blasts — with a template builder, drip sequences, segmentation, A/B testing and deliverability.',
  array['event email marketing','event sms marketing','event invitations','automated event reminders','email drip sequences'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
