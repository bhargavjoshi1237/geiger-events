-- feature page: Custom Domains & White-label Branding (Geiger Events)
insert into public.dash_seo_pages
  (page_type, product, title, slug, excerpt, content,
   hero_heading, hero_subheading, hero_cta_text,
   meta_title, meta_description, keywords,
   is_published, is_featured, published_at)
values (
  'feature',
  'geiger-events',
  'Custom Domains & White-label Branding',
  'custom-domains-branding',
  'Host your event pages on your own domain with your own branding, so the whole experience looks like you — not like a platform borrowing your audience.',
  $html$<p>When your event pages live on someone else's domain under someone else's name, every visit is a small reminder that the relationship isn't really yours. For brands, agencies, and organizers building an audience, that borrowed identity has a cost: weaker trust, diluted branding, and a platform sitting between you and the people you're trying to reach. Custom domains and white-label branding put your event experience back under your own name.</p>

<h2>Your domain, your pages</h2>
<p>Serve your event pages from a domain you control, so the URL people see and share is yours. Attendees move from your marketing to your event page without ever leaving your brand, and the links you send look like they came from you — because they did.</p>

<h2>Branding that's yours end to end</h2>
<p>White-label branding carries your identity through the public experience, so the page an attendee lands on reads as an extension of your brand rather than a template with your logo dropped in. The <a href="/features/events/event-page-builder">page builder</a> already gives you control over design; a custom domain and white-labeling remove the last platform fingerprints around it.</p>

<h2>Consistency across every event</h2>
<p>For organizers running many events, a custom domain makes the whole catalog feel like one coherent presence instead of a scatter of platform-hosted links. It works hand in hand with your <a href="/features/events/organizer-event-page">organizer storefront</a>, so your audience finds and follows you at an address that's unmistakably yours.</p>

<h2>Runs at the workspace level</h2>
<p>Custom domains are managed in your workspace settings alongside team roles and the rest of your configuration, so setting one up is a workspace decision, applied across the events you publish. It's the finishing layer on an experience your <a href="/features/events/attendee-crm">audience</a> already trusts.</p>

<h2>What changes for you</h2>
<p>The platform disappears and your brand takes the whole stage. Attendees trust pages served from your own domain, your branding stays consistent from ad to checkout, and the audience you build is unmistakably yours. See how it fits your plan on the <a href="/pricing">pricing page</a>.</p>

<p><em>Geiger Events is actively shipping. Some capabilities described here are rolling out and specifics may change.</em></p>$html$,
  'Put your events on your own domain',
  'Host event pages on your domain with your branding, so the whole experience looks like you — not a platform borrowing your audience.',
  'Start with Geiger Events',
  'Custom Event Domains & White-label Branding | Geiger Events',
  'Host your event pages on your own custom domain with white-label branding, so every visit stays under your brand — not the platform''s.',
  array['custom event domain','white label event platform','branded event pages','event page custom url','white label ticketing'],
  true,
  false,
  now()
)
on conflict (product, page_type, slug) do nothing;
