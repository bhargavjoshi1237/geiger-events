# 07 — Guests

| | |
|---|---|
| **Nav items** | 8 — Contact Book, Guest List, Who's Going, Attendee Export, Segments, Tags, Notes, Data Requests |
| **Registered** | 8/8 |
| **Tier** | **A — live** (the strongest non-commerce area in the app) |
| **Key files** | `guests/contact_book.jsx` (888), `contact_drawer.jsx` (750), `tags.jsx` (733), `segments.jsx` (660), `data_requests.jsx` (448), `notes.jsx` (433), `guest_import.jsx` (430), `lib/audience/resolve.js` |

---

## 1. What this means in industry

This is the **CRM layer**. In Eventbrite it's thin; in Cvent/HubSpot-for-events it's
the asset the organizer actually owns:

- **Unified contact record** — one person across every event, with lifetime value,
  attendance history, tickets bought, emails opened, sessions attended.
- **Segmentation** — saved, dynamic audiences from behavioural rules ("attended
  2+ events, never bought VIP, opted in"), which then drive campaigns and targeting.
- **Consent & preference management** — per-channel opt-in with proof (timestamp,
  source), suppression lists, and a preference centre the contact controls.
- **Data subject rights** — export, erasure and rectification within a legal SLA,
  with an audit trail proving it happened.
- **Enrichment & dedupe** — merge duplicates without losing history.
- **Bulk everything** — tag 400 people, export a segment, suppress a list.

## 2. What exists today (verified)

Strong, and close to industry parity:
- Contact Book hub with import (`guest_import.jsx`), dedupe, a "Blocked" filter, and a
  per-contact drawer (profile, tags/notes, activity, consent)
- **Real CSV export** — `attendee_export.jsx:168` uses a genuine `downloadCsv` with
  field selection. This is one of the few "export" features in the app that actually exports
- **Real audience resolution** — `lib/audience/resolve.js` powers targeting by
  segment/tag/ticket/offering/add-on/individual across Community surfaces. This is a genuine
  shared system, not a per-screen hack
- Tags (733 lines) with a managed vocabulary, cross-contact Notes feed
- **Data Requests** tracking GDPR/CCPA export/erasure/rectification with 30-day due dates

Gaps:
- **No bulk actions** on the contact table ([00 H5](00-cross-cutting.md)) — the single most
  bulk-oriented surface in the product, and every operation is one row at a time
- Data Requests **tracks** requests but does not **execute** them: there is no
  "produce the export bundle" or "erase across all tables" action, so compliance is manual
  and unproven (and [00 H7 audit log](00-cross-cutting.md) doesn't exist to prove it)
- Consent is recorded but not enforced anywhere — nothing checks opt-in before a send
  (though with no send stack, nothing sends either — see [14](14-campaigns.md))
- Segments are rule-based but there is no "members of this segment right now" preview
  with a count before you use it
- No lifetime-value / attendance-history rollup on the contact record

## 3. Pending deliverables

### P0
- [ ] Bulk actions on Contact Book, Guest List and Who's Going: Tag, Untag, Add to segment, Export selected, Block, Delete
- [ ] Consent enforcement: a single `canEmail(contact, purpose)` helper that the send path must call ([00 H2](00-cross-cutting.md)); transactional vs. marketing purposes treated differently
- [ ] Make Data Requests executable: an "Export data" action that assembles every row for that contact across schemas into a downloadable bundle, and an "Erase" action that anonymizes rather than deletes (orders must survive for accounting)

### P1
- [ ] Contact rollups: events attended, tickets bought, lifetime spend, last activity — computed in a view, shown on the drawer header
- [ ] Segment preview with live count + sample members before saving
- [ ] Merge duplicates preserving history (dedupe currently finds them; merging must be lossless)
- [ ] Suppression list fed by bounces/complaints once a send stack exists

### P2
- [ ] A contact-facing preference centre (the members portal already has auth to host it)
- [ ] Enrichment hooks, and import mapping presets

## 4. UX & component placement

### Contact Book
| Issue | Change |
|---|---|
| **Four `FilterDropdown`s plus search in one `Toolbar`** (`contact_book.jsx:577-600`) — on a laptop this wraps and pushes the table below the fold | Collapse to a single `Filters` button + a chip row of active filters ([00 U5](00-cross-cutting.md)). Keep search right-aligned and always visible |
| No selection column | Add `selectable` + a docked `BulkActionBar` that appears above the table when a selection exists — never a floating overlay, which covers rows |
| Filtered views aren't shareable | Put filter state in the URL via `useWorkspaceUrl()` — "here are our VIPs" should be a link |
| The drawer opens over the table with no record navigation | Add ↑/↓ prev/next in the drawer header, and keep the row highlighted in the list behind it |
| Import and Dedupe are actions on the hub but discovered only by hunting | Put them in an overflow menu next to the primary action in `ScreenHeader.actions` — `[⋯] [Add contact]` — rather than inline in the body |

### Segments
| Issue | Change |
|---|---|
| Rules are authored without feedback | **Rule builder left, live preview right**: matching count updating as you type, plus 10 sample contacts. A segment you cannot see is a segment nobody trusts |
| No indication of where a segment is used | Show "Used by 3 campaigns, 1 announcement" on the row and in the editor — deleting a segment silently breaks targeting today |

### Attendee Export
| Issue | Change |
|---|---|
| Field selection + filters + format all compete on one page | Make it a **two-step flow in one screen**: (1) choose audience — reuse the Segments picker instead of a bespoke filter set; (2) choose fields + format, with a live "N rows × M columns" summary above the Export button |
| Only CSV | Add XLSX and a saved-export concept ("Export this every Monday") once the job runner lands — that's the bridge to [13 Scheduled Reports](13-analytics.md) |

### Data Requests
| Issue | Change |
|---|---|
| Due dates are shown as dates | Show as **time-remaining chips** with a red state under 7 days — this is a legal SLA and the urgency should be visual |
| Tracking without doing | Once P0 lands, the row action becomes `Fulfil → generates bundle → attaches to the request → marks complete`, with the artifact retained as proof |

### Tags / Notes
- Tags: show usage counts and offer merge/rename — tag vocabularies rot without them
- Notes: this is a feed; add filter-by-author and filter-by-contact, and let a note be pinned to the contact drawer

## 5. Schema / API work
- [ ] `events.v_contact_rollup` (events attended, spend, last seen)
- [ ] `events.contact_consent` with `(channel, purpose, granted_at, source, proof)`
- [ ] `events.suppressions` (email, reason, created_at)
- [ ] Erasure routine as a Postgres function that anonymizes across `contacts`, `registrations`, `event_orders`, `notes`, keeping financial rows intact
