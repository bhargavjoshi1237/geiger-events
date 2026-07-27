-- solution page: Workshop & Class Registration (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'solution',
  'geiger-events',
  'Workshop & Class Registration',
  'workshop-class-registration',
  'Take registrations with the details you need, cap every seat, run a waitlist that fills cancellations, send reminders that cut no-shows, and charge for seats — all in one place.',
  $html$<p>Running a workshop or a class means living inside a seat count. There are only so many spots in the room, and every one of them needs the right person in it with the right information attached — skill level, dietary needs, what they want to get out of the day. Registrations trickle in across email and DMs, cancellations open holes you scramble to refill, and the people who signed up three weeks ago quietly forget to show. The teaching is the easy part; the roster is where it all goes sideways.</p>

<h2>The quiet chaos of managing seats</h2>
<p>A plain sign-up link doesn't ask the questions you actually need, so you chase details one reply at a time. It doesn't know when you're full, so you either oversell a room or manually count. When someone drops, the seat sits empty because there's no line to pull from. And nothing nudges registrants as the date approaches, so a class you spent weeks preparing runs half-empty to a no-show list.</p>

<h2>Registration that respects the seat count</h2>
<p>Geiger Events gives hosts a registration flow built around limited seats: the right questions up front, a hard cap, a waitlist that does the refilling, reminders that get people there, and paid seats when you charge.</p>

<h3>Ask what you actually need</h3>
<p>Build a <a href="/features/events/event-registration-rsvp">registration form</a> that collects exactly what matters for your session — experience level, goals, dietary and accessibility needs, custom questions — so everyone arrives prepared and you arrive knowing your room. No more piecing details together from a dozen replies.</p>

<h3>A hard cap and a waitlist that works</h3>
<p>Set a capacity limit and the form closes itself the moment the last seat goes — no oversold rooms. Turn on a waitlist and cancellations get backfilled automatically from the people who wanted in, so a drop-out is a refill instead of an empty chair. Running the same class monthly? Save it as a <a href="/features/events/event-series-recurring">series</a> so each session inherits the last.</p>

<h3>Reminders that actually cut no-shows</h3>
<p>Send confirmations when someone registers and automated reminders as the date nears over <a href="/features/events/event-email-sms-marketing">email and SMS</a>. The single biggest lever on attendance is a well-timed nudge, and it runs on its own once you set it.</p>

<h3>Charge for seats without a second tool</h3>
<p>When your workshop is paid, collect it through <a href="/features/events/event-ticketing-payments">ticketing and payments</a> powered by Stripe — early-bird pricing, discount codes for returning students, the works — from the same page people register on. Fees are transparent and kept low; see the numbers on the <a href="/pricing">pricing page</a>.</p>

<h2>Your students, remembered</h2>
<p>Everyone who registers lands in your <a href="/features/events/attendee-crm">contact list</a>, so returning students are already there for the next session. Announce your next class to people who've taken one before and it fills faster — because you're inviting an audience, not finding one.</p>

<h2>What changes</h2>
<p>The roster stops being a source of dread. Registrations arrive complete, the room never oversells, cancellations refill themselves, reminders bring people through the door, and paid seats collect without a bolt-on. You get to focus on teaching the class instead of assembling the list of who might come.</p>

<blockquote>For workshop, class, and course hosts who need proper registration, hard seat caps, a working waitlist, reminders that cut no-shows, and paid seats in one place.</blockquote>

<p>Compare the fees on the <a href="/pricing">pricing page</a>, or set up your first class registration today.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Registration that respects the seat count',
  'The right questions, a hard cap, a waitlist that refills, reminders that cut no-shows, and paid seats in one place.',
  'Start with Geiger Events',
  'Workshop & Class Registration Software | Geiger Events',
  'Take registrations with custom questions, cap seats, run a waitlist, send reminders, and charge for paid seats — built for workshops, classes, and courses.',
  array['workshop registration','class registration software','event waitlist','course sign-up','paid workshop tickets'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
