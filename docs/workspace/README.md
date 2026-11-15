# Event Workspace

Each event can have a **Workspace**: a back office the organiser builds for that event — their own lists (objects), fields, records, links, views and history. It replaces the retired Operations workspace.

Design: [`docs/superpowers/specs/2026-11-14-workspace-foundation-design.md`](../superpowers/specs/2026-11-14-workspace-foundation-design.md) (sub-project 1 of 8). Plan: [`docs/superpowers/plans/2026-11-14-workspace-foundation.md`](../superpowers/plans/2026-11-14-workspace-foundation.md).

## Deploy

1. `npm run db:push` applies, in order:
   - `20261114100000_retire_operations.sql` — drops every `ops_*` table and function (keeps the four role-write guards), removes the `operations` bucket, and rewrites stored `events.operations.*` permissions to `events.workspace.*`. If Supabase refuses to delete storage rows from SQL, it logs a notice and leaves the bucket; delete it from the dashboard.
   - `20261114110000_workspace_foundation.sql` — tables, indexes, the private `workspace` bucket (50 MB files) and `events.workspace_can`.
   - `20261114120000_workspace_command.sql` — `events.workspace_command`, `events.workspace_query`, `events.workspace_purge`.
2. Environment: `SUPABASE_SERVICE_ROLE_KEY` (already required) and `CRON_SECRET` (already set).
3. `vercel.json` runs `/events/api/internal/workspace/maintenance` daily: empties trash older than 30 days (and orphaned files) and resumes stalled copies.
4. geiger-dash: `'/events/operations/'` was removed from `PUBLIC_PREFIXES` in `utils/supabase/middleware.js`.

## How it fits together

| Area | Where |
| --- | --- |
| Field types (22), validation, conversions | `lib/workspace/schema/types/*`, `schema/definition.js`, `schema/impact.js` |
| Formula language | `lib/workspace/formula/*` |
| Record values, query compiler, CSV | `lib/workspace/records/*` |
| Copying between events, templates | `lib/workspace/carryover/snapshot.js`, `lib/workspace/server/copy.js` |
| Server (routes call these) | `lib/workspace/server/{service,store,import,route,http,send}.js` |
| Staff sign-in + permission checks (shared with Control, MCP, webhooks) | `lib/staff_access/*` |
| API | `app/api/events/[eventId]/workspace/**` |
| Writes | one action per request → `events.workspace_command` (one transaction, permission re-check, change log, replay-safe receipts) |
| Reads | `events.workspace_query` builds SQL from a plan `compileQuery` already validated; it re-checks every field and operator |
| UI | `components/internal/screens/workspace/*`; the event editor sidebar gets a Workspace group (`workspace/nav.jsx`) |

## Rules worth knowing

- Values live in `workspace_records.data` keyed by field id; links live in `workspace_links` (records, contacts, ticket holders, orders, team members, venue spaces of the event's venue).
- Structure edits apply live. Changes that would clear values return `confirm_required` with the impact; the UI asks, then resends with `confirm: true`. Structure changes and record deletes can be undone from the toast.
- Formulas are stored on write and recalculated after structural changes (`after()`); lookups and rollups are calculated when read.
- Unique fields are enforced by `workspace_unique_values` (case-insensitive).
- Permissions: `events.workspace.view | configure | record_create | record_update | record_delete`. Shared views need `configure`; personal views need `view`.
- Copy jobs use ids derived from the job and source item, so a repeated or overlapping batch never duplicates records or files.

## Portals

People outside the team (reviewers, authors, session chairs, volunteers) use the workspace through an event-branded portal at `/e/<eventId>/workspace`. Design: [`docs/superpowers/specs/2026-11-14-workspace-portals-design.md`](../superpowers/specs/2026-11-14-workspace-portals-design.md) (sub-projects 2 + 4). Plan: [`docs/superpowers/plans/2026-11-14-workspace-portals.md`](../superpowers/plans/2026-11-14-workspace-portals.md).

Deploy: `npm run db:push` applies `20261115100000_workspace_portals.sql` (portal settings, roles, pages, published versions, sign-in tokens, form drafts, `events.workspace_portal_config`, `events.workspace_portal_command`, `events.workspace_aggregate`, and policy support in `events.workspace_query`).

| Area | Where |
| --- | --- |
| Roles, rules, field levels → compiled policy | `lib/workspace/portal/{roles,rules,policy}.js` |
| Pages, blocks, layouts (stacked rows or free canvas) | `lib/workspace/portal/{pages,blocks}.js` |
| Reads shaped per viewer, guarded writes | `lib/workspace/portal/{viewer,read,plans,strip,write}.js` |
| Sign-in (6-digit code, invite links), sessions | `lib/workspace/portal/auth.js` (shared `portal_members` account) |
| Builder actions, previews, invites, publishing | `lib/workspace/portal/{staff,publish}.js` |
| Portal API | `app/api/portal/workspace/[eventId]/**` |
| Builder API | `app/api/events/[eventId]/workspace/portal/**` |
| Shared renderer (portal, builder preview, team pages) | `components/workspace_portal/render/*` — blocks talk to an adapter, never to an API directly |
| Portal app | `app/e/[id]/workspace/**`, `components/workspace_portal/shell/*` |
| Builder | `components/internal/screens/workspace/portal/*` (sidebar: Workspace → Portal, plus one item per team page) |

Rules worth knowing:

- "Me" is the person's record in the chosen people list, matched by the (unique) email field. A role is a rule on that list; a person gets every role whose rule they match, plus the built-in Public visitor and Anyone signed in.
- Each role says, per list, which records it sees, edits and deletes (nothing / some by rule / all), whether it can add, comment or change status, and each field's level (hidden, read, edit). Rules can use `@me`, `@my_email`, `@today`, `@record` (on record pages) and look through up to two links.
- Rules compile into the database query (`policy`), so a person can never read or change a record their roles don't allow. A write is checked before and after: nobody can edit a record out of their own reach.
- Hidden fields never leave the server. Formulas, lookups and rollups that depend on a hidden field are hidden too. Links to records the viewer can't open show as "Restricted".
- The portal serves only the published version. Editing in the builder changes the draft; Publish freezes it as a numbered version, and any version can be restored into the draft.
- Team pages are portal pages marked "Team page": they appear in the dashboard sidebar with full staff access, and records open in the staff record sheet.
- The portal's people list and its email field can't be deleted (or made non-unique) while the portal is on.

## Process & automation

Stage rules, automations, approvals and peer review. Design: [`docs/superpowers/specs/2026-11-14-workspace-process-design.md`](../superpowers/specs/2026-11-14-workspace-process-design.md) (sub-project 3).

Deploy: `npm run db:push` applies `20261116100000_workspace_process.sql` (actor kinds `automation`/`api`, `workspace_processes`, `workspace_automations`, `workspace_queue`, `workspace_runs`, `workspace_approvals`, `workspace_review_setups`, `events.workspace_system_command`, `events.workspace_queue_claim`, `events.workspace_approval_decide`, the change → queue trigger and `events.workspace_process_housekeeping`).

| Area | Where |
| --- | --- |
| Stage rules, triggers, steps, placeholders, reviewer assignment (pure, tested) | `lib/workspace/process/{stages,triggers,steps,template,assign}.js` |
| Tables, queue, runs, approvals | `lib/workspace/process/store.js` |
| Claim → match → condition → steps → run log | `lib/workspace/process/engine.js` (`after.js` runs it after a response) |
| Config writes, runs, approvals, review, webhook addresses | `lib/workspace/process/service.js` |
| API | `app/api/events/[eventId]/workspace/{process,runs,approvals,review}`, `app/api/internal/workspace/automations` (CRON_SECRET), `app/api/v1/workspace/hooks/[automationId]/[token]` (public, token in the address) |
| UI | `components/internal/screens/workspace/process/*` (Automations + Runs, Approvals, Review, Stage rules sheet) |

Rules worth knowing:

- Every record change lands in `workspace_changes`; a trigger queues it when the event has an enabled record-triggered automation. Undo and deletes are never queued.
- Automations write through `events.workspace_system_command` as the automation (approvals as themselves, API keys as the key). Each write carries a depth; at depth 3 the run is skipped as "Stopped a loop".
- Instant triggers run right after the request (`after()`); delays, schedules and date triggers wait for the next request, the daily maintenance cron, or anyone pinging `/events/api/internal/workspace/automations` with the cron secret.
- Stage rules are enforced on the server for staff, portal, automations and the API. A refused move is `409 move_not_allowed`; staff who can configure may resend with `force: true` ("Move anyway"). Missing "required to enter" fields are `422 invalid_input` per field.
- Queue items are claimed with a lease (`for update skip locked`) and tried 3 times with back-off; runs are unique per automation, queue item and record, so retries never double-apply.
- Incoming webhook addresses keep only a sha256 of the token; making a new address retires the old one.

## Documents

Email templates, PDF documents built from a record's fields, and certificates anyone can check. Design: [`2026-11-14-workspace-documents-design.md`](../superpowers/specs/2026-11-14-workspace-documents-design.md) (sub-project 6).

Deploy: `npm run db:push` applies `20261117100000_workspace_documents.sql` (`workspace_documents`, `workspace_certificates`, `events.workspace_certificate_public`, and `workspace_purge` keeping certificate files). `next.config.mjs` adds the Noto fonts to every workspace API route's trace.

| Area | Where |
| --- | --- |
| Block catalog, validation, certificate codes (pure, tested) | `lib/workspace/documents/model.js` |
| Text wrapping and pagination → draw ops (pure, tested) | `lib/workspace/documents/layout.js` |
| Drawing with pdf-lib + fontkit, vector QR codes | `lib/workspace/documents/render.js`, fonts in `lib/workspace/documents/fonts/` (OFL) |
| CRUD, preview, generate onto a record, certificates, check | `lib/workspace/documents/{service,store}.js` |
| API | `app/api/events/[eventId]/workspace/documents/{,render,generate}` |
| Public check page | `app/e/[id]/verify/[code]/page.js` (noindex, no sign-in) |
| UI | `components/internal/screens/workspace/documents/*` (Templates · Certificates, PDF and email editors, record-sheet Documents menu) |

Images and backgrounds are fetched through `lib/workspace/net/safe_fetch.js`: public https only, private networks refused, 5 MB, 8 s. Automations gain "Make a document", and "Send an email" can use a template and include a private 14-day link to a freshly made PDF.

## Event components

Schedule, timeline, placement, scanner and pass blocks, the calendar's start date, ticket-aware links and check-in automations. Design: [`2026-11-14-workspace-event-components-design.md`](../superpowers/specs/2026-11-14-workspace-event-components-design.md) (sub-project 5).

Deploy: `npm run db:push` applies `20261118100000_workspace_components.sql` (a trigger on `events.checkin_attendance` that queues check-in automations and never blocks a check-in). Optional: set `WORKSPACE_PASS_SECRET`; otherwise passes are signed with a key derived from the service-role key.

| Area | Where |
| --- | --- |
| Clashes, slots, moves, timeline bars / fill and auto-place / pass signing (pure, tested) | `lib/workspace/components/{schedule,placement,pass}.js` |
| Who a scan means (pass, ticket id or 8-character code, name search) | `lib/workspace/components/{scan,tickets,store}.js` |
| Block validation and data | `lib/workspace/portal/{blocks,plans,read}.js`; `scan.mark` in `portal/write.js`; team pages through `POST …/workspace/portal/scan` |
| Renderers | `components/workspace_portal/render/{schedule,timeline,placement,scanner,pass}_block.jsx`, shared `dated.js` |
| "Match tickets by email" | `POST …/workspace/tickets` from a list's view menu |

## Code & openness

Code steps, custom blocks, the public workspace API and workspace webhook events. Design: [`2026-11-14-workspace-code-openness-design.md`](../superpowers/specs/2026-11-14-workspace-code-openness-design.md) (sub-project 7).

Deploy: `npm run db:push` applies `20261119100000_workspace_openness.sql` (`read:workspace` / `write:workspace` scopes, `workspace_workspaces.hook_secret`, and workspace webhook events from the change log).

| Area | Where |
| --- | --- |
| QuickJS sandbox (32 MB, 1 s, 64 KB in, 256 KB out, no I/O) and the code step's input | `lib/workspace/code/{sandbox,input}.js` |
| Custom block: sandboxed srcdoc with CSP and the `window.geiger` bridge | `lib/workspace/code/bridge.js`, `components/workspace_portal/render/custom_block.jsx` |
| Public API (`/api/v1/workspace/<eventId>/lists[/<list>/records[/<id>]]`) | `lib/workspace/api/records.js`, `app/api/v1/workspace/[eventId]/**` |
| Incoming webhooks | `app/api/v1/workspace/hooks/[automationId]/[token]` |
| Outgoing webhook step (signed with the workspace secret) | `webhook` executor in `lib/workspace/process/engine.js` |

## Templates

Five built-in templates (research conference, hackathon, exhibitors, volunteers, awards) and carry-over of everything above when copying or saving a template. Design: [`2026-11-14-workspace-templates-design.md`](../superpowers/specs/2026-11-14-workspace-templates-design.md) (sub-project 8).

| Area | Where |
| --- | --- |
| References (`#list:`, `#field:`, `#role:`, `#doc:`, `#review:`, `#me`) | `lib/workspace/templates/refs.js` |
| Built-ins and their DSL | `lib/workspace/templates/builtin/*.js`, `templates/dsl.js`, `templates/catalog.js` |
| Installer and the dry-run harness | `lib/workspace/templates/installer.js` (tested in `templates.test.js`) |
| Carry-over for copies and saved templates | `lib/workspace/templates/carry.js`, wired into `lib/workspace/server/copy_instance.js` |
| Gallery | `components/internal/screens/workspace/setup/template_gallery.jsx` (setup screen and Settings) |

## Verification

- `node --test "lib/**/*.test.js" "lib/**/*.test.mjs"` — unit tests.
- `PGLITE_MODULE=<path to @electric-sql/pglite/dist/index.js> node scripts/verify-workspace-db.mjs` — isolated database check of every Workspace migration: retirement, permissions, conflicts, replay, unique values, link scope, undo, query filters and injection attempts, purge, the portal, then process (system command, change queue, leases, approvals, housekeeping), documents (codes, the public check, purge keeping certificate files), components (check-in queueing that never blocks the door) and openness (scopes, webhook secret, webhook events). Each later migration is applied, rolled back and re-applied first.
- `node scripts/seed-workspace-showcase.mjs` — rebuilds the ICAML 2026 showcase: portal, stage rules, review setup, automations (email, code, webhook), documents and one issued certificate.
