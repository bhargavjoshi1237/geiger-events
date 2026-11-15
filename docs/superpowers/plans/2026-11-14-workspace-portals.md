# Workspace Portals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organisers build branded, role-aware pages (portal, public and team) on top of an event's Workspace; outside people sign in at `/e/<eventId>/workspace` and read and edit exactly what their roles allow.

**Architecture:** Configuration (portal settings, roles, pages) lives in new rows edited through a new staff function `events.workspace_portal_config` with change log and undo; Publish freezes them into a numbered snapshot that the portal serves. Every portal read is a `workspace_query` plan built on the server from the published block config plus the viewer's compiled role policy (`plan.policy`, `plan.policyParts`, `plan.searchFields`); every portal write goes through `events.workspace_portal_command`, which re-checks the role rules before and after the change. One React renderer draws pages in the portal, the builder preview and the dashboard team pages, switching only the data adapter.

**Tech Stack:** Next.js 16 App Router (basePath `/events`), Supabase Postgres (`events` schema, SECURITY DEFINER plpgsql), `node:test`, PGlite harness, React 19 + `@geiger/ui`, recharts, lucide-react.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-14-workspace-portals-design.md`.
- New tables and functions: `events` schema, RLS on, grants to `service_role` only; never reachable by `anon`/`authenticated`.
- Migrations use `-- @up` / `-- @down`; the user runs `npm run db:push`; never touch the production DB from here.
- Portal API lives under `/api/portal/workspace/[eventId]/…` (already public in the geiger-dash gate via `/events/api/portal`), portal pages under `/e/[id]/workspace` (public via `/events/e/`).
- Browser fetches always prefix `NEXT_PUBLIC_BASE_PATH`.
- Clients never send query plans, conditions or field lists; the server builds every plan from stored config.
- UI: `@geiger/ui` components, lucide icons, flat suite styling (no glows/gradients/eyebrows), `LogoLoading` for section loaders and `Loader2` on buttons; tabs and filters share one toolbar row; single-line comments.
- No commits or pushes unless the user asks.

## File map

| Path | Responsibility |
|---|---|
| `supabase/migrations/20261115100000_workspace_portals.sql` | Portal tables, `actor_kind`, related conditions, policy-aware query, aggregates, portal command, config command, undo, purge |
| `scripts/verify-workspace-portal-db.mjs` | PGlite checks for the migration (run after Foundation migrations) |
| `lib/workspace/portal/contracts.js` | Limits, block kinds, access levels, built-in role keys, token names |
| `lib/workspace/portal/roles.js` | Role input validation (membership filter, per-list access, field levels) |
| `lib/workspace/portal/pages.js` | Page/block/layout validation, Blocks⇄Canvas conversion, navigation |
| `lib/workspace/portal/blocks.js` | Block catalogue, config validation, block → query plan |
| `lib/workspace/portal/policy.js` | Token resolution, policy compilation, derived hidden fields, per-row levels, write guards |
| `lib/workspace/portal/strip.js` | Remove hidden values, restricted links, per-row field levels |
| `lib/workspace/portal/publish.js` | Snapshot, diff, warnings |
| `lib/workspace/portal/auth.js` | Codes, invites, sessions, rate limits |
| `lib/workspace/portal/emails.js` | Invite and code email HTML |
| `lib/workspace/portal/store.js` | DB access for portal tables and RPCs |
| `lib/workspace/portal/viewer.js` | Builds the viewer (event, snapshot, member, person, roles, policy) |
| `lib/workspace/portal/service.js` | Portal reads/writes: session, block data, record page, commands, files, drafts |
| `lib/workspace/portal/staff.js` | Builder: config commands, publish, versions, invites, people, previews, team data |
| `lib/workspace/portal/client.js` | Browser clients: `portalApi` (outside people) and `builderApi` (staff) |
| `lib/workspace/portal/*.test.js` | Unit tests |
| `app/api/events/[eventId]/workspace/portal/route.js` | Staff GET builder state, POST config commands |
| `app/api/events/[eventId]/workspace/portal/blocks/route.js` | Staff block data (team pages, preview) |
| `app/api/events/[eventId]/workspace/portal/invites/route.js` | Staff invites and people |
| `app/api/portal/workspace/[eventId]/…` | Portal API: session, blocks, record, command, files, drafts, auth |
| `app/e/[id]/workspace/[[...slug]]/page.js` | Portal page (server shell + client app) |
| `components/workspace_portal/render/*` | Shared renderer: page layout, blocks, record view, PDF viewer |
| `components/workspace_portal/shell/*` | Portal shell: brand theme, sidebar, bottom tabs, sign-in, no access |
| `components/internal/screens/workspace/portal/*` | Builder: Pages, Roles & access, Sign-in & people, Publish |
| `components/internal/screens/workspace/{nav,workspace_section}.jsx` | Portal item and team pages in the Workspace group |
| `scripts/seed-workspace-showcase.mjs` | ICAML portal |

---

### Task 1: Database — portal tables, related conditions, policy-aware reads, aggregates

**Files:** Create `supabase/migrations/20261115100000_workspace_portals.sql`, `scripts/verify-workspace-portal-db.mjs`; Modify `scripts/verify-workspace-db.mjs` (apply new migration, call portal checks).

**Interfaces — produces:**
- Tables `workspace_portals`, `workspace_roles`, `workspace_pages`, `workspace_portal_versions`, `workspace_portal_tokens`, `workspace_form_drafts`; `actor_kind` on `workspace_changes`, `workspace_comments`, `workspace_command_receipts` defaulting from `current_setting('workspace.actor_kind', true)`.
- Condition node `{ source: "related", direction: "forward"|"back", fieldId, match: <node> }` (nesting ≤ 2) and system column `created_by` (`cast: "text"`, operator `eq`).
- `workspace_query` plan keys: `policy` (condition, depth ≤ 6), `policyParts: [{ alias: "p0".., condition }]` → row key `policy: { p0: bool }`, `searchFields: [fieldId]` → ILIKE search over title and those fields.
- `events.workspace_aggregate(project, event, plan)` with `plan.measures: [{ alias, fn: count|sum|avg|min|max, fieldId? }]`, optional `plan.groupBy: { source: "system", column: "status" } | { source: "value", fieldId, cast: "text"|"text[]"|"boolean" }` → `{ groups: [{ key, values }] }` or `{ values }`.
- `events.workspace_portal_command(project, event, member, person, guard, command)`.
- `events.workspace_portal_config(project, event, actor, command)` with actions `portal.update`, `role.save|delete|restore|reorder`, `page.save|delete|restore|reorder`, `portal.publish`, `portal.restore_version`; undo for all but reorder/publish.

- [x] Write the migration (replacing `workspace__value_sql`, `workspace__condition_sql`, `workspace_query`, `workspace__undo`, `workspace_purge`; originals restored in `@down`).
- [x] Write `scripts/verify-workspace-portal-db.mjs` asserting: related forward/back/depth-limit; `created_by`; policy filters rows and totals; policyParts per row; searchFields ignores hidden text; aggregate count/sum/group; portal command create/update/delete/comment pass and fail cases (before-scope, after-scope, disallowed field, disallowed status, structure command, receipts per member, actor_kind = portal); config command save/delete/restore/undo/publish/restore_version and configure permission.
- [x] Run `PGLITE_MODULE=<scratchpad>/pglite/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-workspace-db.mjs` → all Foundation and portal assertions pass.

### Task 2: Policy core (pure JS)

**Files:** Create `lib/workspace/portal/{contracts,roles,policy,strip}.js`, `lib/workspace/portal/policy.test.js`.

**Interfaces — produces:**
- `validateRoleInput(input, { definition, portal, roles, roleId })` → `{ key, name, icon, color, membership, access }`.
- `resolveTokens(filter, { personId, memberId, email, today })` → filter with tokens replaced (`{ token: "me" }` in link values → person id; `"my_email"`; `"today"`).
- `compilePolicy({ definition, roles, matched, person, member, today })` → `{ roleIds, objects: { [objectId]: ObjectPolicy } }` where `ObjectPolicy = { view: Part[], create: Part[], edit: Part[], delete: Part[], comment: Part[], levels: { [roleId]: { [fieldId]: "hidden"|"read"|"edit" } }, queryable: string[] }`, `Part = { roleId, filter (API filter|null), fields: string[], status: boolean }`.
- `derivedHidden(definition, objectId, levels, viewable)` → Set of field ids.
- `rowLevels(objectPolicy, rowPolicyFlags)` → `{ [fieldId]: level }` (most open among matching view roles).
- `stripRows(rows, { definition, objectId, objectPolicy, visibleTargets })`.

- [x] Tests: union of roles; per-record levels (Author+Reviewer keeps authors hidden on reviewed paper); title field never hidden; formula/lookup/rollup derived hidden; queryable = intersection; tokens resolved; unknown token rejected; restricted link labels removed; attachments stripped when hidden.
- [x] Implement until `node --test lib/workspace/portal` passes.

### Task 3: Pages, blocks, publish (pure JS)

**Files:** Create `lib/workspace/portal/{pages,blocks,publish}.js`, `lib/workspace/portal/pages.test.js`.

**Interfaces — produces:**
- `validatePageInput(input, { definition, roles, pages, pageId })` → page row shape `{ slug, title, icon, kind, objectId, audience, layout, rows, blocks }`.
- `toCanvas(page)`, `toBlocks(page)`, `orderedBlocks(page)`.
- `navigationFor(pages, roleIds, { signedIn, team })`.
- `BLOCKS` catalogue and `validateBlock(block, ctx)`; `blockPlan(block, { definition, objectPolicy|null, params, tokens })` → `{ objectId, spec, searchFields, policy, policyParts }` or aggregate plan.
- `buildSnapshot({ portal, roles, pages })`, `diffSnapshots(before, after, definition)` → `[{ kind, label, detail }]`, `publishWarnings(snapshot, definition)`.

- [x] Tests: block validation per kind; exposed filter only on queryable fields; plan for table/cards/board/calendar/stats/chart; layout conversions round-trip block order; navigation per role/public/team; diff and warnings.
- [x] Implement until tests pass.

### Task 4: Server — store, viewer, portal service, staff service, auth, emails

**Files:** Create `lib/workspace/portal/{store,viewer,service,staff,auth,emails}.js`, `lib/workspace/portal/service.test.js`; Modify `lib/workspace/server/service.js` (route portal config actions to staff service), `lib/workspace/server/http.js` (DB messages), `lib/email/catalog.js` (two entries).

**Interfaces — produces:**
- `portalViewer({ eventId, request, preview })` → `Viewer = { context, event, portal, snapshot, member, person, roleIds, policy, definition }`.
- `portalService.session(viewer)`, `.blockData(viewer, { pageId, blockId, params })`, `.record(viewer, { objectKey, number })`, `.command(viewer, body)`, `.signUpload(viewer, body)`, `.signFile(viewer, { recordId, fieldId, fileId, inline })`, `.draft(viewer, …)`.
- `portalStaff.state(context)`, `.command(context, body)`, `.blockData(context, { pageId, blockId, params, as })`, `.invites(context, body)`, `.people(context)`.
- `portalAuth.requestCode`, `.verifyCode`, `.acceptInvite`, `.signOut`.

- [x] Service tests with a fake store: hidden fields never in output; Restricted links; search uses visible fields; command guard built from published config; form defaults allowed; public visitor cannot write.
- [x] Implement until tests pass.

### Task 5: API routes

**Files:** Create staff routes under `app/api/events/[eventId]/workspace/portal/` and portal routes under `app/api/portal/workspace/[eventId]/` (`session`, `blocks`, `record`, `command`, `files`, `drafts`, `auth/code`, `auth/verify`, `auth/invite`, `auth/signout`).

- [x] Origin check on portal POST/PUT; `Cache-Control: private, no-store`; rate limits in auth.
- [x] `npm run lint` clean for the new files.

### Task 6: Shared renderer

**Files:** Create `components/workspace_portal/render/{page_view,block_view,use_block_data,record_view,pdf_viewer,form_block,table_block,cards_block,board_block,calendar_block,stats_block,chart_block,content_blocks}.jsx`; Modify `components/internal/screens/workspace/ws_ui.jsx`, `record/field_input.jsx`, `record/link_picker.jsx` (optional `api` adapter prop).

- [x] Adapter contract: `{ blockData(pageId, blockId, params), record(objectKey, number), command(body), lookup(params), signUpload(body), signFile(body), draft: { get, put }, openRecord(objectKey, number), navigate(slug) }`.
- [x] Lint clean.

### Task 7: Portal app at `/e/<id>/workspace`

**Files:** Create `app/e/[id]/workspace/[[...slug]]/page.js`, `components/workspace_portal/shell/{portal_app,portal_theme,portal_nav,sign_in,no_access,person_menu}.jsx`.

- [x] Server page resolves event + session + published snapshot; client shell applies brand tokens; sign-in (code), invite landing, no-access, 404.
- [x] Lint clean.

### Task 8: Builder in the dashboard

**Files:** Create `components/internal/screens/workspace/portal/{portal_screen,use_portal,pages_tab,page_canvas,block_palette,block_inspector,roles_tab,access_sheet,people_tab,publish_tab,team_page}.jsx`; Modify `nav.jsx`, `workspace_section.jsx`.

- [x] Portal item + team pages in the Workspace group; four tabs; preview as role/person; Blocks/Canvas editing; access matrix; invites; publish with diff, warnings and history.
- [x] Lint clean; `npm run build` passes.

### Task 9: Showcase and docs

**Files:** Modify `scripts/seed-workspace-showcase.mjs`, `docs/workspace/README.md`.

- [x] Seed ICAML portal (roles, pages, published version + one draft change); verify read-only through the services with a scratch script (reviewer sees only own reviews, authors hidden, author sees own paper).
- [x] Full checks: `node --test lib/`, PGlite harness, `npm run lint`, `npm run build`.
