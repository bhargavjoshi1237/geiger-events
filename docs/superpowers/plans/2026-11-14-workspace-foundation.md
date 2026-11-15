# Workspace Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship sub-project 1 of the Workspace platform — a per-event, organiser-built backend (objects, 22 field types, links, records, change log, generated management screens, edit mode, carry-over) — and retire Operations.

**Architecture:** Definitions are metadata rows; records live in one `workspace_records` table (`values jsonb` keyed by field id) with a `workspace_links` table. Pure JS modules (`lib/workspace/schema|formula|records|carryover`) own type semantics and validation; one security-definer command function (`events.workspace_command`) owns atomic writes, integrity, idempotency and the change log; one read function (`events.workspace_query`) assembles safe dynamic SQL from a JS-compiled, whitelisted query plan. Staff routes authorise with `@geiger/rbac` and call these through the service role.

**Tech Stack:** Next.js 16 App Router route handlers, supabase-js (service role), PL/pgSQL, `@geiger/ui` + screen kit, `@geiger/rbac`, `node --test`, PGlite harness.

**Spec:** `docs/superpowers/specs/2026-11-14-workspace-foundation-design.md`

## Global Constraints

- User rule: **never `git commit`/`git push`** without explicit instruction. Every "Checkpoint" step = run the listed checks and stop for the next task; no commits.
- User runs `npm run db:push`. Claude validates migrations with the PGlite harness only; never touches the live DB.
- No `public.users` FK: actor/created_by columns are plain `uuid`.
- No RLS policy may read its own table.
- `/e/<id>/workspace` is NOT built here (portals = sub-project 4).
- UI: shared `@geiger/ui` / `@/components/internal/shared/screen_kit` components; flat suite styling — no glows, gradients, grid backdrops, pulsing dots, eyebrow labels or hero panels. Tabs and filters share ONE `Toolbar` row. `LogoLoading` (no `name`) for section/panel loads; `Loader2` on buttons.
- Copy: plain sentences; never show IDs, JSON, "command", "entity", "revision".
- Comments: concise single-line.
- Limits: 50 objects/workspace, 150 fields/object, 500 select options, 1 MB values/record, 50 MB/file, formula ≤ 2,000 chars and depth 32.
- RBAC keys: `events.workspace.view|configure|record_create|record_update|record_delete`, scoped by event.
- Don't screenshot UI (user checks it). Lint touched files; production build only at the end.

## File map

```
supabase/migrations/20261114100000_retire_operations.sql      drop ops_* objects + bucket, swap RBAC grants
supabase/migrations/20261114110000_workspace_foundation.sql   tables, indexes, grants, bucket, helpers
supabase/migrations/20261114120000_workspace_command.sql      events.workspace_command + workspace_query
scripts/verify-workspace-db.mjs                               PGlite harness

lib/workspace/
  contracts.js            limits, key regex, target kinds, system columns
  errors.js               WorkspaceError(code,status,message,fields)
  schema/types/*.js       one module per field type (22) + index.js registry
  schema/definition.js    validateObjectInput, validateFieldInput
  schema/impact.js        analyseFieldChange, analyseFieldDelete, analyseObjectDelete
  formula/{lexer,parser,evaluate,index}.js
  records/values.js       normaliseRecordInput (per-type), titleFor, computeFormulas
  records/query.js        compileQuery(definition, spec) → plan
  records/csv.js          parseCsv, toCsv
  links/resolve.js        resolveLinkLabels, searchEventData, EVENT_TARGETS
  carryover/snapshot.js   buildSnapshot, planCopy (review sentences)
  carryover/runner.js     runCopyBatch
  server/http.js          readJson, handleWorkspaceRequest, DB message map
  server/identity.js      resolveStaffPrincipal (moved from operations)
  server/access.js        authorizeEventAction (moved from operations, WorkspaceError)
  server/route.js         withWorkspaceRoute(request, params, permission, work)
  server/store.js         supabase calls (rpc + reads)
  server/service.js       high-level operations used by routes
  client.js               browser API client

app/api/events/[eventId]/workspace/
  route.js                       GET definition · POST command (structure/records/views/comments/undo)
  records/route.js               POST query (body = spec)
  records/[recordId]/route.js    GET record (links resolved, activity)
  records/import/route.js        POST CSV batch
  lookup/route.js                GET event-data / record search for link pickers
  files/route.js                 POST signed upload · GET signed download
  changes/route.js               GET change log / trash
  copy/route.js                  POST plan|start · GET job status (advances job)
  templates/route.js             GET list · POST save · DELETE
app/api/internal/workspace/maintenance/route.js   daily cron

components/internal/screens/workspace/
  workspace_section.jsx          entry: setup | object screen | settings
  state/use_workspace.js         definition store (focus refetch)
  state/use_records.js           query state per object/view
  setup/setup_screen.jsx, setup/copy_wizard.jsx
  object/object_screen.jsx, table_view.jsx, board_view.jsx, filter_builder.jsx,
         views_menu.jsx, bulk_bar.jsx, csv_import.jsx
  record/record_sheet.jsx, field_input.jsx, field_display.jsx, link_picker.jsx, activity.jsx
  edit/field_menu.jsx, field_sheet.jsx, object_sheet.jsx, impact_dialog.jsx, undo.js
  settings/settings_screen.jsx
```

---

### Task 1: Retire Operations (code, hooks, config)

**Files:**
- Delete: `lib/operations/`, `components/internal/screens/operations/`, `components/portal/operations/`, `app/operations/`, `app/api/events/[eventId]/operations/`, `app/api/portal/operations/`, `app/api/internal/operations/`, `scripts/verify-operations-*.mjs`, `docs/operations/`, `components/internal/screens/events/programme_schedule.jsx`
- Revert to HEAD (ops-only hunks): `components/internal/screens/events/schedule.jsx`, `components/internal/screens/events/page_blocks.jsx`, `components/internal/screens/events/event_detail.jsx`, `components/internal/screens/events/event_sections.js` (then remove the committed Operations group/imports too)
- Modify: `vercel.json` (drop operations cron), `geiger-rbac.config.js` (operations keys → workspace keys)
- Leave untouched: `all_events.jsx`, `venue_lead.jsx`, `recipients_section.jsx`, `all_venues.jsx` (unrelated user edits)

- [ ] Step 1: Before reverting each ops-touched file, confirm with `git diff -- <file>` that every hunk is Operations-related; if a hunk isn't, keep it by hand-editing instead of `git checkout`.
- [ ] Step 2: Move `resolveStaffPrincipal`, `authorizeEventAction`, `evaluationInput`, `verifiedProjectMembership` and the JSON reader into `lib/workspace/server/{identity,access,http}.js` (swap `OperationsError` → `WorkspaceError`, messages "Workspace is unavailable.") before deleting `lib/operations`; carry their tests (`access.test.js`) over.
- [ ] Step 3: Delete the directories/files listed; remove the Operations group, its imports, `opsReady`, and `operations*` keys from `SECTIONS` in `event_sections.js`; remove `useOps` from `event_detail.jsx`.
- [ ] Step 4: `geiger-rbac.config.js`: replace `operationPermissions` with `workspacePermissions` (`view` "View the event workspace", `configure` "Build the event workspace", `record_create` "Add workspace records", `record_update` "Edit workspace records", `record_delete` "Delete workspace records"; group "Event workspace", `scopeBy: "event"`) and replace every `events.operations.*` reference in role presets with the matching `events.workspace.*`.
- [ ] Step 5: `grep -rn "operations" app components lib geiger-rbac.config.js vercel.json` → only unrelated hits (e.g. checkin) remain. `node --test lib/workspace` passes. `npx eslint` on touched files passes.
- [ ] Step 6: Checkpoint.

### Task 2: Workspace contracts, errors, field-type registry (TDD)

**Files:** Create `lib/workspace/contracts.js`, `lib/workspace/errors.js`, `lib/workspace/schema/types/*.js`, `lib/workspace/schema/types/index.js`; Test `lib/workspace/schema/types/types.test.js`

**Interfaces — Produces:**
- `LIMITS = { objects:50, fields:150, options:500, valuesBytes:1_048_576, title:200, shortText:1000, longText:100_000, fileBytes:52_428_800, formulaChars:2000, formulaDepth:32 }`
- `KEY = /^[a-z][a-z0-9_]{0,62}$/`, `TARGET_KINDS = ["record","contact","order","ticket","team_member","venue_space"]`
- `class WorkspaceError extends Error { constructor(code, status, message, fields) }`
- Each type module default-exports `{ type, label, group, defaultConfig, validateConfig(config) → config, normalise(value, config) → value|null (throws WorkspaceError "invalid_value"), cast: "text"|"numeric"|"boolean"|"date"|"timestamptz"|"text[]"|"link"|"file"|"none", operators: string[], convertFrom(fromType, value, config) → {ok, value}, stored: boolean, titleable: boolean }`
- `getType(type)`, `FIELD_TYPES` (22 names: `short_text,long_text,rich_text,email,phone,url,number,currency,percent,rating,single_select,multi_select,checkbox,date,datetime,duration,link_record,link_event,attachments,formula,lookup,rollup`), `SYSTEM_FIELDS = ["number","created_at","created_by","updated_at","updated_by"]`

**Tests (write first, `node --test`):**
- every name in `FIELD_TYPES` resolves; `getType("nope")` → null
- short_text trims, rejects > maxLength, `""` → null; long_text enforces `maxWords` (word = `/\S+/g`) and `maxChars`
- rich_text strips `<script>`, `on*=` attributes and `javascript:` URLs; keeps `p,br,strong,em,u,s,a[href],ul,ol,li,h2,h3,blockquote,code`
- email lowercases domain, rejects "a@b"; url requires http(s); phone keeps `+`, digits, spaces, `-()`, 5–20 digits
- number respects `decimals` (rounds), min/max; currency requires ISO code in config, value number; percent stored as number 0–100 by default; rating integer 1..max (max 3–10)
- single_select value must be an option id; multi_select array of unique option ids; options in config `[{id,label,color}]`, ≤ 500, unique labels
- checkbox boolean; date `YYYY-MM-DD` valid calendar date; datetime ISO with offset → normalised UTC ISO; duration integer seconds ≥ 0
- link_record config `{targetObjectId, multiple}`; link_event config `{target: contact|order|ticket|team_member|venue_space, multiple}`; normalise returns array of `{kind,id}` uuids, single when `multiple:false` → ≤ 1
- attachments: array of `{id,name,size,type}`, ≤ `maxFiles`, type in `accept` list when set
- formula/lookup/rollup: `stored`: formula true, lookup/rollup false; `normalise` throws "read_only" for lookup/rollup
- convertFrom: number→short_text ok; short_text "12" → number ok, "x" → `{ok:false}`; single_select ↔ short_text by label; multi_select → single_select takes first

- [ ] Step 1: Write the tests above. Run `node --test lib/workspace/schema/types` → FAIL (modules missing).
- [ ] Step 2: Implement contracts, errors, the 22 modules and registry.
- [ ] Step 3: Run tests → PASS. Lint.
- [ ] Step 4: Checkpoint.

### Task 3: Object/field definition validation + impact analysis (TDD)

**Files:** Create `lib/workspace/schema/definition.js`, `lib/workspace/schema/impact.js`; Tests alongside.

**Produces:**
- `validateObjectInput(input, { existingKeys }) → { key, name, plural, icon, numberPrefix, statuses:[{key,label,color}] }` — key from name if absent (slugified, unique by suffix), statuses ≤ 50, unique keys
- `validateFieldInput(input, { object, fields, objects }) → { key, name, type, config, required, isUnique }` — calls `getType(type).validateConfig`; link_record target must be a live object; lookup/rollup `linkFieldId` must be a link_record field on this object and `targetFieldId` a field of the target object; formula config `{expression}` parsed with Task 4 parser and may only reference this object's stored fields (no cycles between formulas); `isUnique` only for short_text/email/phone/url/number; title field types: short_text, email, formula, (system) number
- `analyseFieldChange(field, patch, sampleValues) → { converts, clears, examples:[{recordId, from}], destructive }` using `convertFrom`; option removal counts records using removed options
- `analyseFieldDelete(field, { usedByFormulas, usedByLookups, valueCount }) → { blocked: string|null, valueCount }` — blocked when a formula/lookup/rollup depends on it ("Used by the formula *Score total*. Change that first.")

**Tests:** slug + uniqueness; reserved keys; cycle `a = b+1, b = a+1` rejected; lookup through non-link rejected; impact counts on text→number with values `["1","x",null]` → converts 1, clears 1; delete blocked by dependent formula.

- [ ] Steps: tests → FAIL → implement → PASS → lint → Checkpoint.

### Task 4: Formula engine (TDD)

**Files:** Create `lib/workspace/formula/{lexer,parser,evaluate,index}.js`; Test `formula.test.js`

**Produces:** `parseFormula(source) → ast` (throws `WorkspaceError("invalid_formula", 422, "<plain reason> at position N")`), `formulaRefs(ast) → Set<fieldKey>`, `evaluateFormula(ast, valuesByKey, { timeZone }) → number|string|boolean|null`, `FUNCTIONS` list.

Syntax: numbers, `"strings"`, `true/false`, field refs `{Field name}` resolved by name→key at validation (stored expression keeps `{field_key}`), operators `+ - * / %`, `&` (concat), `= != < <= > >=`, `AND OR NOT` (also as functions), parentheses. Functions (30): `IF, AND, OR, NOT, SUM, AVERAGE, MIN, MAX, ROUND, FLOOR, CEILING, ABS, LEN, UPPER, LOWER, TRIM, CONCAT, LEFT, RIGHT, CONTAINS, REPLACE, BLANK, ISBLANK, TODAY, NOW, DATEADD, DATEDIFF, YEAR, MONTH, DAY, FORMATDATE, VALUE, TEXT` (no others). Errors evaluate to `null` (never throw at evaluation). Division by zero → null.

**Tests:** precedence `1+2*3=7`; concat; IF with blank; DATEDIFF days; unknown function rejected with position; depth 33 rejected; 2,001 chars rejected; refs extraction.

- [ ] Steps: tests → FAIL → implement → PASS → lint → Checkpoint.

### Task 5: Record values + query compiler + CSV (TDD)

**Files:** Create `lib/workspace/records/{values,query,csv}.js`; tests alongside.

**Produces:**
- `normaliseRecordInput(definition, objectId, { values, status }, existing) → { values, links:[{fieldId, targets:[{kind,id}]}], title, status }` — unknown/deleted/read-only fields → `WorkspaceError("unknown_field")`; required check on create and when the patch clears a required field; link fields split into `links`; formulas recomputed from merged values; title from title field (number system field → `${prefix}-${n}` filled by DB, title null here); serialized size ≤ 1 MB
- `compileQuery(definition, objectId, spec) → plan` where spec = `{ filter?: {op:"and"|"or", items:[cond|group]}, sort?: [{field, dir}], search?: string, limit≤200, offset, deleted?:bool, groupBy?: field }`, cond = `{field, operator, value}` (`field` = field id or `status|number|title|created_at|updated_at`). Plan = `{ conditions tree with {source:"value"|"system"|"link"|"computed", fieldId, cast, operator, value} , sort, search, limit, offset, deleted, computed:[{alias, fieldId, kind:"lookup"|"rollup", linkFieldId, targetFieldId, fn, cast}] }`. Operators per cast: text `eq,neq,contains,not_contains,starts_with,is_empty,is_not_empty`; numeric `eq,neq,gt,gte,lt,lte,is_empty,is_not_empty`; boolean `is_true,is_false`; date/timestamptz `eq,before,after,on_or_before,on_or_after,is_empty,is_not_empty`; text[] `has_any,has_all,has_none,is_empty,is_not_empty`; link `has_any,is_empty,is_not_empty`. Anything else → `WorkspaceError("invalid_filter")`.
- `parseCsv(text) → string[][]` (RFC 4180, BOM, CRLF), `toCsv(rows) → string`

**Tests:** required on create; deleted field rejected; link split; formula recompute; title; size cap; compile rejects unknown operator; compile maps rollup to computed entry; nested group depth ≤ 3; CSV quotes/newlines round-trip.

- [ ] Steps: tests → FAIL → implement → PASS → lint → Checkpoint.

### Task 6: Database — retirement + foundation tables

**Files:** Create `supabase/migrations/20261114100000_retire_operations.sql`, `supabase/migrations/20261114110000_workspace_foundation.sql`, `scripts/verify-workspace-db.mjs`

Retirement `@up`: `drop function if exists events.ops_* cascade` for every ops function (enumerate from the ops migrations), `drop table if exists events.ops_* cascade` (all 27), delete `storage.objects where bucket_id='operations'` then `storage.buckets where id='operations'` (wrapped in a `do` block that skips if `storage.objects` delete is blocked, raising a notice that the bucket must be emptied via the Storage API), `update public.roles set permissions = (select array_agg(distinct replace(p,'events.operations.','events.workspace.')) from unnest(permissions) p) where exists (select 1 from unnest(permissions) p where p like 'events.operations.%')`; and `record_archive` → `record_delete`. `@down`: comment only (forward-only).

Foundation `@up`: tables per spec §2 with `(project_id, event_id)` FK to `events.events(id, project_id)` (index `ops_events_event_project_uq` is dropped by retirement → recreate as `workspace_events_event_project_uq`), checks (key regex, lengths, jsonb types, `pg_column_size(values) <= 1048576`), `search tsvector generated always as (setweight(to_tsvector('simple', coalesce(title,'')), 'A') || jsonb_to_tsvector('simple', values, '["string","numeric"]')) stored`, indexes per spec, `revoke all … from public, anon, authenticated`, grants to `service_role`, private bucket `workspace` (50 MB), helper `events.workspace_can(project, event, actor, permission) security definer` (project membership + role grant with event scope, as the old `ops_workflow_staff`).

Harness: stub roles/schemas/tables like the old harness (plus `events.contacts`, `events.registrations`, `events.event_orders`, `events.project_members`, `events.venues`, `events.venue_spaces`, `events.events.venue_id`), apply both migrations, assert: tables exist, anon/authenticated denied, bucket private, roles permission rewrite.

- [ ] Step 1: Install PGlite into the scratchpad (`npm i @electric-sql/pglite --prefix <scratchpad>/pglite`).
- [ ] Step 2: Write migrations + harness assertions; run harness → PASS.
- [ ] Step 3: Checkpoint.

### Task 7: Database — command + query functions

**Files:** Create `supabase/migrations/20261114120000_workspace_command.sql`; extend `scripts/verify-workspace-db.mjs`

`events.workspace_command(p_project uuid, p_event uuid, p_actor uuid, p_command jsonb) returns jsonb` (security definer, `search_path=''`, execute to `service_role` only). Envelope `{action, commandId, requestHash, ...}`; receipts replay identical requests and reject a reused id with a different hash (`23505 "Command ID reused"`). Permission per action via `events.workspace_can`; failure → `42501`. Actions:

| action | permission | effect |
|---|---|---|
| `workspace.create {createdFrom}` | configure | insert workspace |
| `workspace.delete` | configure | delete workspace (cascade) |
| `object.create {object, fields?}` | configure | insert object (+ fields), log |
| `object.update {objectId, expectedRevision, patch}` | configure | revision check (40001), log before/after |
| `object.delete / object.restore {objectId}` | configure | soft delete/restore, log |
| `field.create {objectId, field}` | configure | insert at end, log |
| `field.update {fieldId, expectedRevision, patch, conversions?:[{recordId, value}]}` | configure | update def; apply conversions (store old values in change `before`) |
| `field.delete / field.restore {fieldId}` | configure | soft delete/restore |
| `field.reorder {objectId, order:[fieldId]}` | configure | positions |
| `field.recompute {fieldId, updates:[{recordId, value}]}` | configure | write formula results without bumping record revision |
| `record.create {objectId, values, status, links, title}` | record_create | number from `next_number`, title default `${prefix}-${n}`, unique values, links |
| `record.update {recordId, expectedRevision, values, status?, links?, title?}` | record_update | merge values (null removes key), replace links for given fields, unique values, log diff |
| `records.bulk {recordIds, values?, status?}` | record_update | same per record, one change row each |
| `records.import {objectId, rows:[{values,status,links,title}]}` | record_create | batch create (≤ 500) |
| `records.delete / record.restore` | record_delete | soft delete/restore |
| `comment.add {recordId, body}` | record_update | insert comment |
| `view.save {viewId?, objectId, name, shared, config}` / `view.delete` | shared → configure, personal → view | upsert |
| `change.undo {changeId}` | configure | structure changes and record deletes only |

Integrity checks: every values key is a live field of the object with a stored type; link targets scoped (`record` same event + target object matches field config; `contact` same project; `order`/`ticket` same event; `team_member` project_members same project; `venue_space` belongs to the event's `venue_id`); unique via `workspace_unique_values` (md5 of lower(value#>>'{}')); records in deleted objects reject writes. Errors use `22023` with stable messages for the JS message map.

`events.workspace_query(p_project, p_event, p_object, p_plan jsonb) returns jsonb` (security definer, service_role): validates every field id belongs to the object, cast/operator ∈ whitelist, builds SQL with `format('%L')`/`%I`, computed lookups/rollups as correlated subqueries over `workspace_links`, search via `to_tsquery('simple', <sanitised prefix terms>)` OR `title ilike`, returns `{rows, total}`; rows include `id, number, title, status, values, revision, createdAt, updatedAt, createdBy, updatedBy, computed`.

Harness assertions (≥ 60): permission denial per action; stale revision 40001; replay returns same response; reused id different hash rejected; unique violation; cross-event/project link rejected for each kind; values key not in object rejected; delete/restore/undo for field, object, records; field conversion stored in change before and restored on undo; query filters per cast, OR groups, sort, search, rollup count/sum, lookup, deleted toggle, injection attempt (`fieldId` = `'x'') or 1=1--'`) rejected.

- [ ] Steps: write function + assertions → run harness → PASS → Checkpoint.

### Task 8: Server layer + routes

**Files:** `lib/workspace/server/{http,route,store,service}.js`, `lib/workspace/links/resolve.js`, `app/api/events/[eventId]/workspace/**`, `app/api/internal/workspace/maintenance/route.js`, `vercel.json`; tests `service.test.js`, `http.test.js` (store injected as a fake).

**Produces (service, all take `context = {projectId, eventId, principal}`):**
- `getDefinition(context) → { workspace|null, objects:[...with fields, views] }`
- `runCommand(context, body) → result` — validates per action with Tasks 2–5 modules (normalise values, definition validation, compute formula values, impact checks requiring `confirm:true` for destructive field changes), then `store.command`. After formula-affecting field changes, schedules recompute via `after()`.
- `queryRecords(context, objectId, spec) → { rows (with resolved link labels), total }`
- `getRecord(context, recordId) → { record, links, backlinks, activity, comments }`
- `lookup(context, { kind, objectId?, q }) → [{kind,id,label,sub}]` (≤ 20)
- `importRows(context, objectId, { mapping, rows }) → { created, errors:[{row, message}] }`
- `listChanges(context, { kind?, before?, trash? })`
- files: `signUpload(context, { fieldId, name, size, type }) → { file, uploadUrl }`, `signDownload(context, fileId) → url`
- copy: `planCopy(context, { sourceEventId, choices }) → { sentences, counts }`, `startCopy → { jobId }`, `advanceCopy(jobId) → job`
- templates: `listTemplates`, `saveTemplate({ name, description, includeSamples })`, `deleteTemplate(id)`, apply via `startCopy({ templateId })`

Route permissions: GET definition/records/record/lookup/changes → `view`; POST command → checked inside service per action (route checks `view`, service re-authorises the action's permission); import → `record_create`; files upload → `record_update`; copy/templates/maintenance per spec. Maintenance cron: `CRON_SECRET` bearer; purge trash > 30 days (records, fields, objects, orphan files) and advance stalled copy jobs. `vercel.json` adds daily `/events/api/internal/workspace/maintenance`.

- [ ] Steps: service tests with fake store (action → permission mapping, destructive change requires confirm, formula recompute scheduled) → FAIL → implement → PASS → lint → Checkpoint.

### Task 9: Carry-over + templates (TDD)

**Files:** `lib/workspace/carryover/{snapshot,runner}.js` + tests.

**Produces:** `buildSnapshot(definition, choices) → snapshot`, `planCopy(sourceDef, targetDef, choices, counts) → { sentences:[string], structure, recordPlan }`, `runCopyBatch(job, store) → job` (idempotent per batch via job `cursor`; id map persisted).

**Tests:** skipped target drops link field + sentence; event-data links: contact/team kept, order/ticket/venue_space cleared with count sentence; merge into existing object appends and lists unmatched fields; renumbering; rerunning a finished batch doesn't duplicate.

- [ ] Steps: tests → FAIL → implement → PASS → Checkpoint.

### Task 10: UI — nav, setup, state

**Files:** `components/internal/screens/workspace/{workspace_section.jsx,state/use_workspace.js,state/use_records.js,setup/setup_screen.jsx}`, `lib/workspace/client.js`, modify `event_detail.jsx`, `event_sections.js`.

- `event_detail.jsx`: `const ws = useWorkspace(event.id)`; nav = `withWorkspaceNav(NAV_GROUPS, ws)` inserting a **Workspace** group after the event's operational groups: no workspace → one item `workspace` "Set up workspace"; else one item per live object `ws:<objectId>` (label = plural, icon from object icon via lucide name map) + `workspace-settings`. `SECTIONS` lookup falls back to `WorkspaceSection` for keys starting `ws:` / `workspace`.
- `use_workspace.js`: fetch definition, refetch on window focus and after commands; `run(action, payload)` → generates `commandId`, retries once on network error with same id, toasts plain errors, returns result.
- Setup screen: `EmptyState` + three choices (Start empty → `workspace.create`; Use a template → template list; Copy from another event → wizard from Task 13).

- [ ] Steps: implement → lint → Checkpoint.

### Task 11: UI — object screen (table, board, filters, views, bulk, CSV)

**Files:** `object/{object_screen,table_view,board_view,filter_builder,views_menu,bulk_bar,csv_import}.jsx`, `record/{field_display,field_input}.jsx`.

- Header: `EditorSectionHeader` (object plural, record count) with actions New, Import, Export, Edit structure toggle (configure only).
- `Toolbar` one row: `SegmentedTabs` (Table/Board + saved views) left; filter popover, sort, group, search right.
- Table: sticky first column (title), inline editing per type via `field_input`, column resize/reorder/hide persisted to the current view, row checkboxes → `bulk_bar` (Set field, Change status, Delete, Export CSV), infinite pagination (`limit 100`).
- Board: columns = status or a single-select field; drag (native HTML5 DnD) → update; per-column counts.
- Filter builder: and/or groups (depth ≤ 3), operators labelled in plain words per cast.
- CSV import sheet: upload → map columns (auto-match by name) → preview first 20 rows with errors → import in batches of 500 with progress.

- [ ] Steps: implement → lint → Checkpoint.

### Task 12: UI — record sheet + edit mode

**Files:** `record/{record_sheet,link_picker,activity}.jsx`, `edit/{field_menu,field_sheet,object_sheet,impact_dialog,undo}.jsx`.

- Record sheet (wide `Sheet`): title, status, fields in order (hidden fields excluded), link pickers (search via lookup route, chips), attachments (signed upload, progress), backlinks section, Activity tab (changes + comments box).
- Edit mode: column header menu (Rename, Edit field, Hide, Delete), "+ Add field" column → `field_sheet` (type picker grouped as spec §3, type-specific settings, required/unique toggles), drag-reorder headers, object settings sheet (name, plural, icon via `IconPicker`, number prefix, title field, statuses list editor with colours), New object. Every structural change → `toast` with Undo (`change.undo`); destructive → `impact_dialog` with counts and examples then `confirm:true`.

- [ ] Steps: implement → lint → Checkpoint.

### Task 13: UI — settings, copy wizard, templates

**Files:** `settings/settings_screen.jsx`, `setup/copy_wizard.jsx`.

- Settings: Import from another event (wizard), Save as template, Change log (filter structure/records, who, when, plain sentence per change), Trash (restore; days left), Delete workspace (type the event name).
- Copy wizard (`Sheet`, 3 steps): source event picker → per-object choice rows (Skip / Structure only / Structure + records [All | saved view]), field untick list, attachments switch → review sentences → start → progress (polls job; each poll advances it).

- [ ] Steps: implement → lint → Checkpoint.

### Task 14: Final verification + docs

- [ ] `node --test lib/workspace` all pass; PGlite harness passes; `npx eslint` on all touched files; `npm run build` passes.
- [ ] `docs/workspace/README.md`: deploy steps (`npm run db:push` → 3 migrations; storage bucket note; cron), architecture table, verification commands.
- [ ] Tell the user: run `! npm run db:push`; remove `'/events/operations/'` from geiger-dash `PUBLIC_PREFIXES`; UI not visually verified by Claude.
- [ ] Update memory `workspace-platform.md`.
