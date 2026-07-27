-- feature page: Registration & RSVP (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Registration & RSVP',
  'event-registration-rsvp',
  'Collect RSVPs with custom registration forms, capacity limits, waitlists with auto-promotion, approval gates, dietary and accessibility questions, plus-ones and conditional questions.',
  $html$<p>Registration is where an interested visitor becomes a confirmed attendee — and where most of your operational headaches start if the form is dumb. Geiger Events gives you a registration and RSVP flow you can shape to the event: ask exactly what you need, cap the numbers, gate who gets in, and let the system handle the waitlist and confirmations so you're not doing it by hand.</p>

<h2>RSVPs and custom registration forms</h2>
<p>Turn on RSVPs for a free event or build a full registration form for something more involved. Add the fields you actually need — name, contact, and any custom questions — and drop them onto the form without touching code. A quick meetup can be a one-tap yes; a workshop or conference can collect everything you need to run the day.</p>

<h3>Conditional questions</h3>
<p>Only show a question when it's relevant. Ask about a workshop track only to people who pick the workshop; ask for a company name only from the professional tier. Conditional logic keeps the form short for everyone and detailed where it counts, which means more people finish it.</p>

<h3>Dietary and accessibility questions</h3>
<p>Capture dietary needs and accessibility requirements right in the form so you can plan catering and access before the day, not scramble the morning of. The answers land with the attendee's record, so your team sees them wherever they're working.</p>

<h2>Control who gets in, and how many</h2>
<p>Set a capacity limit and the form stops taking sign-ups once you're full — no oversold room, no awkward turn-aways at the door. Combine it with the other gates below to run everything from an open community night to a tightly managed private event.</p>

<h3>Approval gates</h3>
<p>Require approval before a registration is confirmed. Review each request and approve or decline, so an invite-only dinner, a members' session, or a vetted professional event only admits the people you actually want. Applicants know they're pending until you decide.</p>

<h3>Waitlist with auto-promotion</h3>
<p>When you hit capacity, extra sign-ups join a waitlist instead of bouncing off a "sold out" wall. If a spot opens — a cancellation, a raised cap — the next person is promoted automatically and notified, so the room stays full without you watching it. You keep the demand you'd otherwise lose.</p>

<h2>Make sign-up effortless for attendees</h2>
<h3>Plus-ones and group registration</h3>
<p>Let a registrant bring guests with plus-ones, or register a whole group in one go. One person handles the sign-up for their friends, team, or family, and every attendee still gets counted and tracked individually — which keeps your capacity and check-in accurate.</p>

<h3>Confirmation page</h3>
<p>The moment someone registers, they land on a confirmation page that tells them what happens next — the details, what to bring, how to add it to their calendar. It's the reassurance that turns a form submission into a committed attendee, and it's the natural handoff to their ticket.</p>

<h2>Registration that feeds the whole event</h2>
<p>Every registration flows straight into the rest of your workspace. Sign-ups become contacts in your <a href="/features/events/attendee-crm">attendee CRM</a>, so your guest list builds itself. Paid events connect registration to <a href="/features/events/event-ticketing-payments">ticketing and checkout</a>, and confirmed attendees get a QR ticket ready for <a href="/features/events/event-check-in-app">check-in</a> at the door. You send confirmations and reminders through <a href="/features/events/event-email-sms-marketing">email and SMS</a>, and none of it requires re-entering a single name.</p>

<h2>One form, built for your event</h2>
<p>Because registration lives inside the same event as your page, tickets, and attendee list, there's no export, no import, no reconciling two systems the night before. You design the questions, set the limits and gates, publish, and let sign-ups roll in — with the waitlist, approvals, and confirmations running on their own. Whether you're taking a hundred free RSVPs or vetting a small paid cohort, the flow bends to the event instead of forcing the event to bend to it.</p>

<p>Start simple with an open RSVP, then add capacity, approval, and custom questions as the event grows. The registration form is never a dead end — it's the on-ramp to everything else you run in Geiger Events.</p>

<p>And because the form is part of the event rather than a separate signup tool, the answers you collect stay useful long after the sign-up. A dietary note reaches your catering plan, an accessibility request reaches your team, and an approved applicant becomes a ticketed attendee — each without anyone retyping a thing. The work you put into the form pays off at every step that follows.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Registration and RSVP that runs itself',
  'Custom forms, capacity limits, waitlists with auto-promotion, approval gates, dietary and accessibility questions, plus-ones and conditional logic — all in one flow.',
  'Start with Geiger Events',
  'Event Registration Software & RSVP | Geiger Events',
  'Collect RSVPs and registrations with custom forms, capacity limits, auto-promoting waitlists, approval gates, and dietary and accessibility questions.',
  array['event registration software','online rsvp','event registration form','event waitlist','rsvp management'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
