# Workspace — Portals (sub-projects 2 + 4 of 8)

Date: 14 November 2026 · Status: design approved by the user in conversation, awaiting spec review
Builds on: [Workspace Foundation](2026-11-14-workspace-foundation-design.md) (built, migrations pushed)

## Summary

The Workspace stores any event's data, but only staff can use it today. Portals add the presentation layer: organisers build branded pages from blocks, define roles with record and field rules, and invite outside people — reviewers, authors, judges, session chairs, volunteers — who sign in at `/e/<eventId>/workspace` and work there. The same pages can also be published to the team inside the dashboard. A peer reviewer reads a paper and enters remarks; an author submits and tracks a paper; a chair takes attendance — all without the organiser writing code or outsourcing a front end.

## Decisions

| Topic | Decision |
|---|---|
| Scope | Roadmap 2 (Interface builder) and 4 (Access & portals) built together as one project, "Portals". |
| Sign-in | Shared Geiger account (`portal_members`, same as `/login`). Invite links and 6-digit email codes; passwords optional. |
| Who is "me" | The organiser picks a **people list** and its email field; a signed-in person is the record whose email matches. |
| Roles | A role is a **condition on the people list** (filter builder). A person can match several roles; access is the union. |
| Look | Event-branded app using the event page design tokens (`resolveTheme`, `.ev-themed`), light and dark. |
| Open access | Pages can be public; self sign-up via a public form (email verified first). |
| Builder | Pages have two layout modes: **Blocks** (stacked rows of 1–3 columns) and **Canvas** (free 12-column grid). Same block library. Live preview as any role or person. |
| Audience | One builder for portal pages, public pages and team pages (dashboard). |
| Enforcement | Role rules compile into the Workspace's whitelisted query plans and are enforced by Postgres on reads and writes; hidden fields are stripped server-side. |
| Publishing | Builder edits a draft; Publish snapshots it; the portal serves only published versions; versions can be restored. |

## 1. Concepts

All concepts belong to one event's workspace.

- **Portal** — one per event at `/e/<eventId>/workspace`. Settings: enabled, people list, email field, display-name field, self sign-up on/off, welcome text, contact email, and the published version pointer. Branding is not stored here; it comes from the event page design.
- **Role** — key, name, icon, colour, and a **membership condition** on the people list. Two built-in roles exist and cannot be deleted: **Public visitor** (anyone, signed in or not) and **Anyone signed in** (a matched person with any or no custom role). A custom role never matches an unmatched account.
- **Access** — per role, per list:
  - `view`, `create`, `edit`, `delete`, each `none`, `all`, or `where` + a record rule (condition);
  - `comment` on/off (requires view);
  - per-field visibility `hidden` / `read` / `edit` (default: `read` for every field when view is granted; `edit` only where set).
- **Page** — key, title, icon, slug, kind (`page` or `record` + list), audience (`roles: [roleId]`, `public: bool`, `team: bool`), layout (`blocks` or `canvas`), blocks, position. Each list can have one **record page** used when a record is opened from any block; without one, a default record layout is generated from the person's visible fields.
- **Block** — id, kind, config, and placement (`row/column` for Blocks layout, `x/y/w/h` on a 12-column grid for Canvas).
- **Version** — numbered snapshot of portal settings, roles and pages; the portal and team pages read the published version, the builder reads the draft.

### Combining roles

A person's effective access is the union over matched roles, evaluated **per record**:

- An action is allowed on a record when any matched role's rule for that action matches the record.
- A field's visibility on a record is the most open level among the matched roles whose `view` rule matches that record. A person who is both Author and Reviewer therefore sees author names on their own papers but not on the papers they review.
- Editable fields on a record are the union of `edit` fields from roles whose `edit` rule matches it.
- Filtering, sorting, grouping and searching may only use fields visible under **every** matched role that can view the list (the intersection), so ordering or match counts can never reveal a field hidden on some rows.

The query returns, per row, which roles' view rules matched (one boolean per role), and stripping uses that row's set.

### Record rules and "me"

Rules are ordinary Workspace conditions (the existing filter builder and `workspace__condition_sql`) plus:

- **Me tokens**, resolved on the server per request: `me` (the person's record id — usable in link-field conditions `has_any`), `my_email`, `today`, `now`. Unknown tokens are rejected at save time.
- **Built-in record columns**: `created_by_me` (record created by this portal person).
- **Related records** (new): "this record has a linked record, through link field F, that matches condition C". F may be a link field on this list (forward) or a link field on another list pointing at this list (backlink). Nesting depth is limited to 2. This is what lets a reviewer view *Papers that have a Review where Reviewer is me*, or a session chair view *Attendance whose Session has Chair is me*.

Examples (ICAML):

| Role | List | Rule |
|---|---|---|
| Reviewer | Reviews | view/edit where Reviewer has_any `me`; edit additionally requires Status = Draft |
| Reviewer | Papers | view where *related Reviews (Paper) matches Reviewer has_any `me`*; Authors, Corresponding author hidden |
| Author | Papers | view where Authors has_any `me`; create allowed; edit where Authors has_any `me` and Status in (Draft, Revision requested) |
| Session chair | Attendance | view/create/edit where *related Session matches Chair has_any `me`* |

### Derived hidden fields

A field is also hidden for a role when it is a formula, lookup or rollup that reads a hidden field, directly or transitively. Derivation runs on the server whenever the policy is compiled; the builder shows derived-hidden fields with a "hidden because it uses Authors" note.

## 2. Sign-in and people

**Accounts.** Portal people are `portal_members` rows; sessions use the existing `portal_sessions` table and `geP_session` cookie (30 days). A person who already has a tickets account uses the same account.

**Matching.** The people list's email field must be unique to enable the portal (the existing unique-values guard enforces it). Matching is case-insensitive. The match is recomputed on every request; nothing about roles is cached in the session.

**Ways in:**

1. **Invite link.** Staff select people (or a role) and choose *Send portal invite*. Each person gets an email with a single-use link valid 7 days: `/e/<eventId>/workspace/invite?token=…`. Accepting creates the `portal_members` account if missing, starts a session, and lands on the portal home. A used or expired link shows "Email me a new link".
2. **Email code.** The sign-in screen asks for an email, then a 6-digit code valid 10 minutes. Codes are entered inline, so form drafts survive. People with a password may use it instead.
3. **Self sign-up** (when enabled). A public form with sign-up asks for the email and code first, then shows the form. Submitting creates or updates the person's record in the people list from the form's person fields, creates the submission linked to them, and leaves them signed in.

**No access.** A signed-in account with no matching person, or matching no role that grants any page, sees "You don't have access to this event yet" with the portal's contact email. Public pages remain visible.

**Emails.** Two new catalog entries in `lib/email/catalog.js`: `workspace_portal_invite` and `workspace_portal_code`, sent with `sendNotificationEmail`, event-branded (name, logo, brand colour), switchable in notification settings (code emails cannot be switched off while the portal is enabled).

**Limits.** Codes: 5 per email per hour, 5 attempts per code, hashed (sha256) with expiry. Invite tokens: hashed, single use, revocable. All sign-in endpoints answer identically whether or not the email exists.

**Staff.** A team member visiting the portal while signed in to the dashboard gets a "Preview as…" bar; staff accounts never receive portal access by being staff.

## 3. Pages and blocks

### Layout modes

- **Blocks**: rows; each row has 1–3 columns with widths (e.g. 1/3 + 2/3); each column holds stacked blocks. On narrow screens columns stack in order.
- **Canvas**: a 12-column grid; each block has `x, y, w, h` (grid units, row height 24px). On narrow screens blocks stack in reading order (by `y`, then `x`).
- Switching Blocks → Canvas places blocks to match their current positions; Canvas → Blocks groups blocks into rows by overlapping `y` ranges.

### Block catalogue

Every data block has a **source**: list, filter (condition with me tokens), sort, and limit. The server ANDs the source filter with the viewer's `view` rule.

| Block | Config |
|---|---|
| Table | Columns (visible fields), exposed filters (fields the viewer may filter by), search on/off, page size, row action (open record page / none), inline edit on/off |
| Cards | Cover (image or file field), title, status chip, 2–4 fields, columns (1–3), row action |
| Board | Group-by (status or single choice), card fields, drag allowed when the viewer may edit the group field |
| Calendar | Date or date-range field, month/week default, label field |
| Record details | Record from the page context, or "my record" (the person's own people-list record); sections of fields; show linked records, attachments, comments, activity |
| Form | Target list, fields in sections or steps, help text per field, required overrides, prefill (e.g. link to me), open/close dates and timezone, submit label, confirmation message and follow-up page, draft autosave on/off; sign-up on/off (public pages only) with person fields (asked of the submitter) and person defaults (fixed values set on their people-list record, e.g. Type includes Author, so the right role matches) |
| Stats | 1–4 tiles: count / sum / average / min / max / percent of matching, each with its own filter |
| Chart | Bar, line or donut; group-by field; measure (count or aggregate of a number field) |
| Text | Rich text (existing sanitiser) with variables: event name, dates, venue, person name, today |
| Image | Uploaded image, alt text, fit, link |
| Buttons | 1–4 buttons: go to page, open form, external URL |
| Divider | Spacing and optional line |

Block configs are validated on the server (`lib/workspace/portal/blocks.js`) on every page command. A block that references a deleted list or field becomes an "unavailable block" placeholder in the builder and renders nothing in the portal.

### Record pages and navigation

- Opening a record from any block navigates to `/e/<eventId>/workspace/r/<listKey>/<recordNumber>` and renders that list's record page (or the default layout) only if the viewer may view that record.
- Navigation shows pages whose audience includes one of the viewer's roles (or public), in builder order. Record pages are not in the navigation.

## 4. Builder in the dashboard

The event's Workspace group gains a **Portal** item. Its toolbar row holds `SegmentedTabs`: **Pages · Roles & access · Sign-in & people · Publish**. Team pages appear in the Workspace group as items (`section=wp-<pageId>`).

**Pages tab** (layout and drag patterns from the existing event page builder):

- Left panel: page list grouped Portal / Public / Team, drag to reorder; record pages per list; add page.
- Centre: the page rendered with real data through the preview endpoint; toolbar with **Preview as** (role or specific person), desktop/phone width toggle, Blocks/Canvas toggle. Click a block to select it; drag to move; on Canvas, drag handles resize with snapping.
- Right panel: the selected block's inspector (source, fields, display, actions) or the page settings (title, icon, slug, audience, layout).
- Palette: "Add block" popover listing the catalogue.

**Roles & access tab:** matrix of roles × lists showing a summary per cell ("View: where Reviewer is me · 2 hidden"). A cell opens a `Sheet` with the action rules (filter builder with me tokens and related-records conditions), comment toggle, and field visibility list with bulk set. A live line reports, for the preview person, "Can see N of M records". The role list edits name, icon, colour and membership condition, with a live "N people match".

**Sign-in & people tab:** people list and email field pickers (with the uniqueness check), display-name field, self sign-up toggle, welcome text, contact email; invites (send to selection or role, resend, revoke) and a people table with last sign-in.

**Publish tab:** a readable diff of draft vs published (pages, blocks, roles, access), warnings (a public page shows a people-list field; a role gains `edit` on a field another role hides; a block references a hidden field for its audience), Publish with an optional note, and version history with Restore (restore loads that version into the draft).

All builder changes are workspace commands with undo and change-log entries, gated by `events.workspace.configure`. Publishing is also `configure`.

## 5. The portal at `/e/<eventId>/workspace`

**Route.** `app/e/[id]/workspace/[[...slug]]/page.js` server-renders the shell with the event's branding (`resolveTheme(event.pageDesign)`, `.ev-themed`, favicon, title, `theme-color`). Paths: `/` (home = first page), `/<pageSlug>`, `/r/<listKey>/<number>`, `/sign-in`, `/invite`.

**Shell.** Desktop: slim sidebar (event logo, navigation, person menu with name, roles, account link, sign out). Phone: bottom tabs (first 4 pages + More). Light/dark follows the event viewer setting with a visitor toggle remembered per event. Brand colours are checked for contrast against the surface; a failing brand colour falls back to the neutral foreground for text while keeping it for fills.

**Data.** Block data loads client-side through the portal API using the basePath-aware fetch helper; `LogoLoading` placeholders are sized per block; buttons use inline spinners. The client sends only a block id and viewer parameters (page, search, exposed filter values, sort among allowed fields); the query plan is always built on the server from the published block config.

**Record page.** Header (title, status chip, list name), fields in organiser sections with inline editing where allowed (save per field, undo toast), linked records as chips (Restricted when not viewable), attachments with an inline PDF/image viewer, comments when allowed, the viewer's own activity. Desktop shows the viewer beside an editable form when a page pairs a Record details block with a Form or editable fields (split view); phones stack.

**Forms.** Sections or steps with a progress indicator, required marks, help text, a validation summary, autosaved drafts (per person, per form block), file uploads with progress through signed upload URLs, open/close dates shown in the event timezone, and a branded confirmation with a link to the created record.

**States.** Empty states with organiser wording; closed forms; conflict ("Changed by someone else — reload" using record revisions); failed save with retry; 404 for pages and records the viewer can't see, with no hint they exist.

**Accessibility.** Keyboard navigation and visible focus, labelled inputs, `aria-live` save status, reduced motion respected.

## 6. Data model

Migration `20261115100000_workspace_portals.sql` (events schema; RLS on; grants to `service_role` only, like Foundation):

| Table | Columns (main) |
|---|---|
| `workspace_portals` | `project_id, event_id` (PK, FK workspace), `enabled`, `people_object_id`, `email_field_id`, `name_field_id`, `signup_enabled`, `settings jsonb` (welcome, contact), `draft_revision bigint`, `published_version_id`, timestamps |
| `workspace_roles` | `id, project_id, event_id, key, name, icon, color, membership jsonb, access jsonb, position, deleted_at`, timestamps; unique `(project_id, event_id, key)` among live rows |
| `workspace_pages` | `id, project_id, event_id, key, slug, title, icon, kind, object_id, audience jsonb, layout, blocks jsonb (≤ 512 KB), position, deleted_at`, timestamps; unique live slug; one live record page per list |
| `workspace_portal_versions` | `id, project_id, event_id, number, snapshot jsonb, note, published_by, published_at`; unique `(project_id, event_id, number)` |
| `workspace_portal_tokens` | `id, project_id, event_id, email, purpose ('invite','code'), token_hash, member_id, expires_at, attempts, used_at, revoked_at, created_by, created_at`; index on `(email, purpose, created_at)` |
| `workspace_form_drafts` | `project_id, event_id, member_id, page_id, block_id` (PK), `data jsonb (≤ 1 MB)`, `updated_at` |

Changes to Foundation tables: `actor_kind text not null default 'staff' check (actor_kind in ('staff','portal'))` on `workspace_changes`, `workspace_comments` (for `created_by`) and `workspace_command_receipts` (added to the primary key). `workspace_purge` also removes expired tokens after 30 days, drafts untouched for 90 days, and soft-deleted roles and pages after 30 days.

**Functions:**

- `workspace_command` gains `page.create|update|delete|restore|reorder`, `role.create|update|delete|restore|reorder`, `portal.update`, `portal.publish`, `portal.restore_version` (all `configure`, with undo where reversible).
- `workspace__condition_sql` gains the `related` node (forward or backlink, depth ≤ 2) and the `created_by_me` column; the me tokens are substituted in JS before the plan reaches the database.
- `workspace_query(project, event, plan)` accepts `plan.policy` (a condition ANDed with `plan.filter`), `plan.policyParts` (`[{alias, condition}]`, returned per row as booleans, one per matched role's view rule) and `plan.queryableFields` (search, filter, sort and group may only reference these; requested lookups/rollups must be among them). Portal search uses `ILIKE` over queryable text fields instead of the `search` tsvector.
- New `workspace_portal_command(project, event, member uuid, person uuid, guard jsonb, command jsonb)`, security definer, `service_role` only. Allowed commands: `record.create`, `record.update`, `records.delete`, `comment.create`. The guard lists, per action, parts `[{condition, fields}]` (one per matched role). A command passes when one part's condition matches the record before the change (update/delete/comment) and after it (create/update), and every changed field is in that part's fields. Any other command is rejected. It logs with `actor_kind = 'portal'` and uses receipts keyed by member.

## 7. Server and API

Library: `lib/workspace/portal/`

- `policy.js` — `compilePolicy(definition, portal, roles, person)` → per list `{ view, create, edit, delete, comment, fields }` with conditions resolved (me tokens), union across roles, derived hidden fields.
- `membership.js` — find the person by email; evaluate role membership with one `workspace_query` per role (count with `filter = membership AND id = person`).
- `blocks.js` — block catalogue, config validation, `planForBlock(block, policy, params)`.
- `pages.js` — page validation, layout conversion, navigation for a policy.
- `publish.js` — snapshot, diff, warnings.
- `strip.js` — removes hidden fields, restricted link labels and unsigned file references from rows and records.
- `auth.js` — tokens, codes, invite acceptance, rate limits.

Routes:

| Route | Who | Purpose |
|---|---|---|
| `POST /api/events/[eventId]/workspace` (existing) | staff | page, role, portal and publish commands |
| `POST /api/events/[eventId]/workspace/portal/preview` | staff `configure` | render data for a draft page as a role or person |
| `POST /api/events/[eventId]/workspace/portal/invites` | staff `configure` | send, resend, revoke invites |
| `GET /api/portal/workspace/[eventId]/session` | portal | person, roles, navigation |
| `POST /api/portal/workspace/[eventId]/blocks/[blockId]` | portal / public | block data |
| `GET /api/portal/workspace/[eventId]/records/[listKey]/[number]` | portal / public | record page data |
| `POST /api/portal/workspace/[eventId]/command` | portal | guarded record commands |
| `POST /api/portal/workspace/[eventId]/files` | portal | sign upload / download |
| `PUT /api/portal/workspace/[eventId]/drafts/[blockId]` | portal | form draft autosave |
| `POST /api/portal/workspace/[eventId]/auth/{code,verify,invite}` | anyone | sign-in flows |

The geiger-dash suite gate already lets `/events/e/` and `/events/api/portal` through (`PUBLIC_PREFIXES`), so no gate change is needed. Builder configuration goes through a separate staff function, `events.workspace_portal_config` (configure permission, receipts, change log), so `workspace_command` itself is unchanged; `change.undo` reaches portal changes through the extended `workspace__undo`. Queryable-field checks run in the server layer, which is the only caller of the read functions; the database applies `plan.policy`, `plan.policyParts` and `plan.searchFields`.

## 8. Security

- Clients never send query plans, conditions or field lists; the server builds them from the published snapshot.
- Reads: `plan.policy` is ANDed in the database for rows, counts, stats and charts.
- Writes: `workspace_portal_command` re-checks rules before and after, and the allowed fields.
- Hidden fields, including derived ones, are removed before responses leave the server; filter, sort, group and search may not reference them.
- Links to records the viewer cannot view render as Restricted (no title, no id).
- File downloads are signed only when the field and the record are visible; uploads go to `workspace/<project>/<event>/portal/<member>/…` and are attached by a guarded command.
- Public visitor rules apply to unauthenticated requests; public block requests are rate limited per IP.
- Write endpoints check the `Origin` header against the app origin.
- Drafts are never served to the portal; preview requires staff `configure`.

## 9. Errors

Existing database codes map to portal messages: rule or field violation (`42501`) → "You can't change this record"; revision conflict (`40001`) → "Changed by someone else — reload"; unique (`23505`) → "Already used"; closed form → "Submissions are closed". Anything else returns a generic message and logs the code without record data.

## 10. Testing

- Unit (`lib/workspace/portal/*.test.js`): policy compilation and union, me tokens, related conditions, derived hidden fields, block validation and plans, layout conversion, publish diff and warnings, strip.
- PGlite harness (`scripts/verify-workspace-portal-db.mjs`): `related` conditions both directions and depth limit; `plan.policy` on rows, totals and aggregates; hidden-field filter/sort/search rejected; `workspace_portal_command` before/after scope, disallowed fields, structure commands rejected, receipts by member.
- Service tests: stripping, Restricted links, search leak, file signing, membership.
- Route tests: code and invite flows, rate limits, identical responses for unknown emails, Origin check.
- Lint clean, all tests pass, `npm run build` passes.

## 11. Showcase

`scripts/seed-workspace-showcase.mjs` gains a portal for ICAML 2026: people list People (email unique), roles Reviewer (blind: author fields hidden), Author, Programme chair, Session chair; pages *Home* (stats + guidance), *My reviews* (cards → record page with PDF viewer and review form), *Submit a paper* (public, self sign-up, open until 1 Sep), *My submissions*, *Programme* (public, accepted papers by session), *Session attendance* (session chairs), team page *Chair's desk* (board of papers by status + stats); one published version and one draft change waiting to publish.

## 12. Out of scope

Automation, status emails, reviewer auto-assignment and conflict-of-interest checks (sub-project 3); scheduler and scanner attendance (5); certificates and PDFs (6); code, API and webhooks (7); custom domains; live multi-user updates; offline use; portal in the mobile app.

## 13. Deploy

1. User runs `npm run db:push` for `20261115100000_workspace_portals.sql`.
2. No geiger-dash change (portal paths are already public).
3. Deploy geiger-events (with Foundation, which is not yet committed).
4. Re-run `node --env-file=.env scripts/seed-workspace-showcase.mjs` for the demo.
