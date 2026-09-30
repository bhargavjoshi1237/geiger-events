# Sponsorship — design

Date: 2026-09-29
Status: approved for implementation

Let an organiser sell sponsorship against an event without taking payment on
the platform: define the spots on offer, publish a prospectus that tells
prospects how to get in touch, collect interest through a form the organiser
builds, and fill spots by hand once a deal is agreed off-platform. Confirmed
sponsors then show on the event page in a layout the organiser controls.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Where spots live | Per event, seeded from a Sponsorship Package tier | Spots are what *this* event sells; copy-on-create keeps packages as templates without a sync problem |
| Deals | Off-platform, filled in manually | The organiser negotiates by email/phone; the platform records the outcome |
| Interest capture | Contact methods + an organiser-built form | Contact methods for people who'd rather call; the form so no lead is lost in an inbox |
| Public surface | Standalone `/e/<id>/sponsor` prospectus + an optional link from the event page | A shareable prospectus URL is what organisers send to prospects |
| Logos on the event page | A `sponsors` page block, fully customisable | Confirmed sponsors are otherwise never shown publicly today |
| Storage | Member-only event sponsorship configuration, public metadata projection, and a private enquiries table | Agreed amounts, internal notes and enquiry links must never reach anonymous event reads |

## Data

Private configuration and three public metadata keys, each owned by one editor section:

```js
events.event_sponsorship.spots // full Spot[]; authenticated project members only
event.sponsorship      // public projection of spots, public sponsor fields and reservation counts
event.sponsorshipPage  // prospectus copy, contact methods, form fields
event.sponsorsDisplay  // how the event page shows sponsors + the "become a sponsor" link
```

`save_event_sponsorship` writes the private configuration and publishes its
snapshot in one transaction. A metadata trigger also guards generic updates.
The public projection omits agreed amounts, internal notes, enquiry IDs and
package source IDs. Pending sponsor identities are published only when the
organiser explicitly enables **include pending**; their occupied slots still
count toward availability when their identity stays private. Prospectus asking
prices and quantities remain public.

```js
Spot = {
  id, name, tier, description, benefits: [text],
  price,            // null = "on request"
  quantity,         // how many sponsors this spot takes
  open,             // listed on the prospectus and requestable
  sourcePackageId,  // the Sponsorship Package it was seeded from, if any
  fills: [Fill],
}
Fill = {
  id, sponsorId, amount, status: "pending" | "confirmed", note, enquiryId,
  sponsor: { name, logoUrl, website, description }, // public snapshot
}
```

The fill snapshots the sponsor's public fields because the event page is
anonymous and `conference_records` is members-only. The snapshot is refreshed
from the live records whenever spots are saved. `metadata.sponsorIds` is kept in
sync with confirmed fills so the legacy attach key stays truthful; an event that
still has legacy `sponsorIds` and no spots gets a one-click "add as a spot"
banner instead of a silent conversion.

Migration `20260930150932_private_sponsorship_fills.sql` preserves any existing
full sponsorship configuration before stripping its public metadata. Apply
this migration before releasing the updated editor. It deliberately has no
rollback that moves private deals back into public metadata.

`events.sponsor_enquiries` holds form submissions: company, contact name,
email, the spot asked about, `answers` (custom fields snapshotted with their
labels), status `new → contacted → converted | declined`, and the sponsor it was
converted into. anon may INSERT only a `new`, unconverted row and never SELECT;
project members do everything else.

## Editor — "Sponsorship" group in the event editor

1. **Sponsor Spots** (`sponsors` key, replaces the old attach section) — spot
   list with sold/left, a spot dialog, and a fill dialog (pick a sponsor or
   create one inline with a logo; amount, status, note).
2. **Sponsor Enquiries** — the inbox; status changes, reply by email, and
   "Fill spot" which opens the fill dialog pre-filled from the enquiry.
3. **Sponsor Page** — prospectus on/off, copy, contact methods (email, phone,
   WhatsApp, booking link, note), the form builder, consent text.
4. **Sponsor Display** — the event-page strip (heading, layout: wall / grid /
   marquee / list, grouping, logo size, feature top spot, columns, card style,
   alignment, colour or muted logos, names, spot labels, website links, include
   pending) and the "become a sponsor" link (on/off, style: link / button /
   banner, label, banner copy, destination: prospectus / contact email /
   custom URL, show before any sponsor exists), with a live preview.

The form builder is the registration-forms question editor, extracted into a
shared `FormFieldsEditor`; a matching `FormFieldsInputs` renders it publicly
with the same show-when rules. Company, name and email are fixed fields because
converting an enquiry needs them.

## Out of scope

- Taking sponsorship payment online.
- A separate designer for the prospectus — it uses the event page's theme.
- A project-wide enquiries inbox; deriving package "sold" counts from fills.
- Custom (page-builder) mode keeps its manual logo wall. Themed events with a
  saved block list add the Sponsors block from the library.
