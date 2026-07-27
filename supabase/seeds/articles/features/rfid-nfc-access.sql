-- feature page: RFID / NFC Access & Smart Badges (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'RFID / NFC Access & Smart Badges',
  'rfid-nfc-access',
  'Admit attendees with a tap of an RFID wristband, card, or NFC badge instead of a scanned QR — faster entry for high-volume events.',
  $html$<p>At a festival gate or a busy conference door, the bottleneck isn't the decision to let someone in — it's the seconds spent lining up a camera on a screen. Tapping a wristband is faster than scanning a phone, and it works when a battery is dead or a screen is cracked. RFID and NFC access in Geiger Events lets attendees enter with a tap of a credential they wear, so a high-volume gate keeps moving.</p>

<h2>Tap to enter</h2>
<p>Instead of admitting attendees by scanning a QR, RFID and NFC entry admits them by tapping a physical credential — an RFID wristband, a card, or an NFC badge. You choose the medium that fits your event: a wristband for a multi-day festival, a card or NFC badge for a conference. Each credential maps to a real attendee on your list, so a tap checks the same person in that a scan would, and flows into the same <a href="/features/events/event-check-in-app">check-in</a> record.</p>

<h3>Encode with confidence</h3>
<p>Programming a batch of credentials is the part that goes wrong at scale, so encoding is built around verification. Export the attendee-to-ID map to program your devices, then upload the encoded file back and Geiger checks it against a computed checksum before the event — so you catch a mismatch in the office, not at the gate with a line building behind it. Turn checksum verification on and every batch is validated before it ever touches an attendee.</p>

<h2>Built for the parts QR can't reach</h2>
<p>Smart badges and RFID open up things a paper or phone ticket can't do well: fast re-entry across a multi-day pass, tap access to specific zones, and a credential that survives a weekend outdoors. Because each tap is tied to an attendee identity, entries still feed your <a href="/features/events/attendee-crm">attendee records</a> and real-time attendance the same way a scan does — you get the speed of a tap without giving up the data of a check-in.</p>

<h3>Alongside, not instead of</h3>
<p>RFID and NFC don't replace the rest of your door — they join it. The same event can admit some attendees by wristband tap and others by QR ticket or wallet pass, all against one list, so you're never locked into a single method. Turn it on for the events that need it and leave it off for the ones that don't, and switch it on per event from the check-in settings when it applies.</p>

<h3>One credential, less to carry</h3>
<p>A wristband or smart badge is also one fewer thing for an attendee to manage across a long event. There's no phone to keep charged, no email to keep handy, and nothing to re-download if a device resets — the credential is on their wrist or around their neck for the duration. For a multi-day pass, that durability is the difference between a smooth weekend and a re-issue desk with a line.</p>

<h2>Where it fits</h2>
<p>RFID, NFC, and smart badges are the high-throughput end of the on-site suite, sitting next to QR tickets, wallet passes, badge printing, and lead retrieval. For how the full toolkit works together, see the <a href="/features/events/event-check-in-app">check-in page</a>, and check what's included on each plan on the <a href="/pricing">pricing page</a>.</p>

<h2>Why it matters</h2>
<p>Every method of entry is really a trade between speed, resilience, and cost. QR is instant to issue; a tap is instant to read. For a gate moving thousands of people, or an outdoor event where phones die and screens fog, a physical credential that admits on contact — and that you've verified before the doors open — is what keeps the line short and the entrance calm.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Tap a wristband, and they''re in',
  'Admit attendees with RFID wristbands, cards, or NFC smart badges instead of a scanned QR — with verified encoding before doors open.',
  'Start with Geiger Events',
  'RFID & NFC Event Access & Smart Badges | Geiger Events',
  'Admit attendees with a tap of an RFID wristband, card, or NFC badge instead of a scanned QR. Verified encoding and one attendee list for high-volume gates.',
  array['rfid nfc event access','rfid wristband entry','nfc smart badges','tap to enter events','festival access control'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
