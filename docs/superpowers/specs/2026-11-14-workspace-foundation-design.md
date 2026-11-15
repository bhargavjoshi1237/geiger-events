# Workspace — Foundation (sub-project 1 of 8)

Date: 14 November 2026 · Status: design approved section by section, awaiting spec review
Replaces: the event Operations workspace ([2026-09-30](2026-09-30-event-operations-workspace-design.md), [2026-11-13](2026-11-13-operations-workspace-completion-design.md)), which is retired by this sub-project.

## Goal

Give every event an optional **Workspace**: a backend the organiser builds for their own event, good enough that they choose it instead of outsourcing a custom system. A research conference (submissions → approval → presentation assignment → room placement → attendance → certificates) is one example; a hackathon, exhibitor operations, a volunteer programme or an awards programme must be equally buildable.

The old Operations workspace could not do this: its roles were fixed by a database check (`presenter, evaluator, staff, volunteer, participant`), resources were limited to `room`/`equipment`, People/Resources/Activities were fixed tables, there were 8 field types, table/board views only, 8 hard-coded editor sections and 3 hard-coded portal roles.

## Decisions (made with the user, 14 Nov 2026)

| Topic | Decision |
|---|---|
| Purpose | Replace outsourcing. API and webhooks come last, not first. |
| Scope | One workspace **per event**; carry-over from earlier events with detailed control. |
| Name | "Operations" is renamed **Workspace** everywhere. |
| Custom code | Allowed later, sandboxed (sub-project 7). |
| Old Operations | Retired: code removed and `ops_*` tables dropped. The uncommitted 13 Nov Operations work is discarded, not archived. |
| URLs | `/e/<eventId>/workspace` hosts **portals only** (sub-project 4). Staff manage and build inside the dashboard event editor. |
| Builder | An **Edit structure** toggle inside the management screens, not a separate builder. |
| Storage | Definitions as metadata rows; records in shared tables (`jsonb` values, a links table, indexes). No runtime DDL. |
| Structure edits | Apply live, with impact warnings, an undo for every change, and a 30-day trash. |
| Event-data links | Contacts, ticket holders & orders, team members, venue spaces. |

## Roadmap

Each sub-project gets its own spec, plan and build.

| # | Sub-project | Delivers | Needs |
|---|---|---|---|
| 1 | **Foundation** (this spec) | Workspace, objects, 22 field types, links, records, change log, generated management screens, edit mode, carry-over, Operations retired | — |
| 2 | Interface builder | Organiser-built pages from blocks (table, board, calendar, timeline, record layout, form, stats, charts); workspace navigation | 1 |
| 3 | Process & automation | Stages and transitions, approvals and review (rubric, N reviewers, blind, conflict of interest), trigger → condition → action rules, scheduled runs, run log, emails | 1 |
| 4 | Access & portals | Organiser-defined roles, record rules, hidden fields, portals at `/e/<id>/workspace`, personal links, preview as role, portal publish step | 1, 2 |
| 5 | Event components | Scheduler grid, placement (rooms, booths, seats, shifts), scanner attendance, deeper ticket/order/check-in links | 1, 2 |
| 6 | Documents | Email and PDF templates, certificates with a public verification page | 3 |
| 7 | Code & openness | Sandboxed code steps and custom components, API, webhooks | 3, 4 |
| 8 | Templates | Research conference, Hackathon, Exhibitors, Volunteers, Awards — built with no new code (the acceptance test for the whole platform) | all |

## 1. Concepts and architecture

Six concepts, all scoped to one event:

- **Workspace** — an event's backend; off until created (empty, from a template, or copied from an earlier event).
- **Object** — a kind of thing tracked (Paper, Reviewer, Booth application, Shift): name, plural, icon, title field, optional statuses. In Foundation statuses are a plain list for filtering and grouping; transitions and rules arrive in sub-project 3.
- **Field** — a typed property of an object.
- **Record** — one row of an object.
- **Link** — a relation from a record to another workspace record or to event data. Event data is read-only to the workspace.
- **Change log** — every record and structure change with actor, time, before and after. Structure changes are undoable.

Code layout:

```
lib/workspace/
  schema/      field types, object/field validation, change-impact analysis
  records/     value validation + normalisation, query builder (filter/sort/search on jsonb)
  links/       workspace + event-data link resolvers (contacts, orders, tickets, team, venue spaces)
  formula/     parser + evaluator for formula fields
  carryover/   snapshot builder, copy planner, copy job runner
  server/      command entry point → events.workspace_command
components/internal/screens/workspace/   management UI (setup, object screen, record panel, edit mode, settings)
app/api/events/[eventId]/workspace/      staff routes (reads, commands, files, copy jobs, templates)
```

All writes go through one route that checks permissions and calls `events.workspace_command` (security definer): one transaction per command, permission re-check, validation against the current definition, change-log row, optimistic concurrency via `revision`, idempotency via command receipts. Reads go through server routes with the service role; browsers never touch the tables.

## 2. Data model

All tables live in `events`, keyed by `(project_id, event_id)` with a cascading foreign key to `events.events(id, project_id)`.

| Table | Holds |
|---|---|
| `workspace_workspaces` | One row per event: `revision`, `created_from jsonb` (`{kind: empty\|template\|event, ref}`), timestamps |
| `workspace_objects` | `id`, stable `key`, `name`, `plural`, `icon`, `title_field_id`, `statuses jsonb [{key,label,color}]`, `number_prefix`, `next_number`, `position`, `revision`, `deleted_at` |
| `workspace_fields` | `id`, `object_id`, stable `key`, `name`, `type`, `config jsonb`, `required`, `is_unique`, `position`, `revision`, `deleted_at` |
| `workspace_records` | `id`, `object_id`, `number`, `title` (denormalised from the title field), `status`, `values jsonb` (keyed by field id), `search tsvector`, `revision`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` |
| `workspace_links` | `source_record_id`, `field_id`, `target_kind` (`record`, `contact`, `order`, `ticket`, `team_member`, `venue_space`), `target_id`, `position`; many per field |
| `workspace_unique_values` | `(object_id, field_id, value_hash)` unique, maintained by the command function for unique fields |
| `workspace_files` | Attachment metadata (record, field, path, name, type, size); bytes in the private `workspace` storage bucket |
| `workspace_comments` | Staff comments on a record |
| `workspace_saved_views` | Object, name, owner (null = shared), `config jsonb` (view kind, columns, filters, sort, group) |
| `workspace_changes` | `actor_id`, `kind` (`record`/`structure`), target ids, `action`, `before`, `after`, `undo_of`, `created_at` |
| `workspace_command_receipts` | Idempotency: actor, command id, request hash, response |
| `workspace_templates` | Project-level snapshots (structure, optional sample records) |
| `workspace_copy_jobs` | Copy-from-event jobs: plan, status, progress, id map, last error |

`created_by`/`updated_by`/`actor_id` are plain `uuid` columns with no foreign key (this database has no `public.users`).

Indexes: `workspace_records (project_id, event_id, object_id, status, updated_at desc) where deleted_at is null`; GIN `values jsonb_path_ops`; GIN `search`; `workspace_links (target_kind, target_id)` for backlinks; `workspace_changes (project_id, event_id, created_at desc)`.

Limits: 50 objects per workspace, 150 fields per object, ~100k records per workspace, 500 select options, 1 MB per record's values.

## 3. Field types

Each type is one module in `lib/workspace/schema/types/<type>.js` exporting `validateConfig`, `normalise`, `compare`, `filterOperators`, `toSql` (filter/sort expression) and `convertFrom(otherType)`. Adding a type means adding a file and registering it.

| Group | Types |
|---|---|
| Text | Short text, Long text (character and **word** limits), Rich text, Email, Phone, URL |
| Number | Number (decimals, min/max), Currency (ISO code), Percent, Rating (1–N) |
| Choice | Single select, Multi-select, Checkbox |
| Time | Date, Date & time (stored UTC, shown in the event's time zone), Duration |
| Links | Link to record (target object, one or many), Link to event data (contact / ticket holder / order / team member / venue space; one or many) |
| Files | Attachments (max count, allowed types, max size ≤ 50 MB) |
| Computed | Formula, Lookup, Rollup (count/sum/avg/min/max) |
| System | Auto number, Created at/by, Updated at/by (always present, not added by the organiser) |

That is 22 organiser-addable types, plus the system fields. The title field must be Short text, Email, Formula or Auto number.

- **Formula** — a small expression language: arithmetic, comparison, text concatenation, `IF`, `AND`, `OR`, `NOT`, date maths and about 30 functions; it references fields of the same record only. Parsed by our own parser (no `eval`), max 2,000 characters and nesting depth 32. The result is stored in `values` on write and recomputed for all records when the formula or a referenced field definition changes.
- **Lookup / Rollup** — computed at read time from `workspace_links`, so always current; filterable and sortable through the query builder.
- **Repeating groups** (e.g. co-authors) are modelled as linked child records, not a field type.
- **Type changes** run through a compatibility table. Incompatible values are listed in an impact preview ("12 values can't convert; they'll be cleared and kept in the change log") and need confirmation.

## 4. Management UI and edit mode

**Navigation.** The event editor sidebar gets a **Workspace** group (`components/internal/screens/events/event_sections.js`). Before setup it shows only **Set up workspace**; afterwards it lists each object by its plural name, then **Workspace settings**. If the `@geiger/ui` sidebar cannot take data-driven items, the fallback is a single **Workspace** item with an object switcher on its toolbar row.

**Setup.** An `EmptyState` with three choices: Start empty, Use a template (listed once any template exists), Copy from another event (§5).

**Object screen.** `EditorSectionHeader`, then one `Toolbar` row: view tabs (`SegmentedTabs`) left; filter, search and New right. Shared `@geiger/ui` components throughout; flat suite styling, no glows, gradients or hero panels.

- **Table** — inline cell editing; show, hide, resize and reorder columns; sort; filter builder (and/or groups, operators from the field type); group by.
- **Board** — columns by status or any single-select field; drag a card to change the value.
- **Saved views** — named column/filter/sort/group sets, shared or personal.
- **Bulk actions** — set a field, change status, delete, export CSV.
- **CSV import** — map columns to fields, preview row errors, then import; link columns match by title (records) or email (contacts, team members, ticket holders).

**Record panel.** A wide `Sheet`: fields in order; **Linked records** including backlinks ("3 Reviews link here"); **Activity** (the record's change log plus staff comments).

**Edit mode.** Staff with `events.workspace.configure` see an **Edit structure** toggle in the header. When on: a field menu on each column header (rename, type and settings, hide, delete), a trailing "+ Add field" column, drag to reorder fields, object settings (name, icon, statuses, number prefix, title field) and New object. Field settings open in a `Sheet` with type-specific options. Every change applies immediately with an **Undo** toast; data-losing changes show the impact preview first. Deleted fields and objects go to a 30-day trash (Workspace settings → Trash) and restore with their values.

**Workspace settings.** Import from another event, Save as template, Change log (filterable), Trash, Delete workspace (typed confirmation).

**Permissions (staff only in Foundation).** `events.workspace.view`, `.configure`, `.record_create`, `.record_update`, `.record_delete`, scoped by event in `geiger-rbac.config.js`. Per-object and per-record rules arrive in sub-project 4.

**Collaboration.** Stale writes → "Someone else changed this. Reload — your edits are kept." Data refetches on window focus and after each save. No live sync.

**Loading.** `LogoLoading` for section and panel loads (40–56 px), `Loader2` on buttons.

## 5. Carry-over and templates

One format underlies all copying: a **workspace snapshot** (objects, fields, statuses, saved views; optionally records). "Copy from another event", "Save as template" and Geiger templates (sub-project 8) all produce or apply snapshots.

**Copy from another event** (at setup, and later as Workspace settings → Import from another event):

1. **Source** — any event in this project with a workspace the user can view.
2. **Per object** — Skip / Structure only / Structure + records. With records: All, or one of that object's saved views. Fields can be unticked individually. An **Include attachments** switch copies files.
3. **Review** — plain sentences before anything is created, e.g. "Link field *Reviewer* on Papers will be dropped because Reviewers is skipped." and "Contacts and team members carry over. Ticket holders, orders and venue spaces belong to the old event, so those 214 links will be cleared." Comments and history are not copied; each copied record's history starts with "Copied from <event>".
4. **Into an existing workspace** — an object whose key already exists gets records appended; fields are matched by key and type; unmatched fields are listed as skipped.

**Execution.** Structure is created in one transaction. Records are copied by a resumable job (`workspace_copy_jobs`) in batches of 500, with an old→new id map so record-to-record links are rebuilt. Progress is shown; a failed batch can be retried without duplicates. Copied records are renumbered from 1 per object.

## 6. Retiring Operations

Done in the same release:

- **Delete code:** `lib/operations`, `components/internal/screens/operations`, `components/portal/operations`, `app/operations`, `app/api/events/[eventId]/operations`, `app/api/portal/operations`, `app/api/internal/operations`, `scripts/verify-operations-*.mjs`, `docs/operations`.
- **Unwind hooks:** the Operations group in `event_sections.js`; Operations bits in `event_detail.jsx` and `all_events.jsx`; the "Published programme" schedule source (`programme_schedule.jsx`, `schedule.jsx`, `page_blocks.jsx`). Events with `metadata.scheduleSource = 'programme'` fall back to "Your items". Check the other modified files in the working tree (`venue_lead.jsx`, `recipients_section.jsx`, `all_venues.jsx`) and keep any non-Operations changes.
- **Config:** remove the `/events/api/internal/operations/notices` cron from `vercel.json`; replace `events.operations.*` RBAC keys with `events.workspace.*`.
- **Migration:** drop every `ops_*` table and `ops_*` function (including `ops_workflow_command`, `ops_public_programme`, link functions), delete role grants for `events.operations.*` and grant `events.workspace.*` to the system admin and manager roles, drop the `operations` storage bucket. If Supabase blocks deleting `storage.objects` from SQL, a one-off script empties the bucket through the Storage API before the push.
- **geiger-dash:** remove `'/events/operations/'` from `PUBLIC_PREFIXES` in `utils/supabase/middleware.js`.
- Older Operations specs stay in `docs/superpowers` as history.

## 7. Security

- `workspace_*` tables: all privileges revoked from `public`, `anon`, `authenticated`; only `service_role` through server routes, writes only through `workspace_command`.
- Routes check the `events.workspace.*` permission for the event; the command function re-checks project/event scope.
- Event-data links are scope-checked: contacts and team members must belong to the project; orders and ticket holders must belong to this event; venue spaces must belong to a venue linked to this event.
- Rich text is sanitised against an allowlist on write.
- Files: private bucket, signed upload and download URLs, type and size limits from the field config.
- Formula engine: own parser, no `eval`, length and depth limits, no cross-record access.
- No row-level policy reads its own table (avoids recursion, see 42P17 history).

## 8. Errors

Plain sentences, never IDs, JSON or "command" wording. Field-level messages in forms. Stale write → reload prompt that keeps edits. Network failure → automatic retry with the same command id (idempotent), then "We couldn't confirm that saved — Retry". 403 → "You don't have permission to change this workspace." Destructive structure changes always show the impact preview first.

## 9. Maintenance

A daily cron (`/events/api/internal/workspace/maintenance`, `CRON_SECRET`) purges trash older than 30 days (fields, objects, records and their files) and resumes stalled copy jobs. Daily is the Vercel Hobby limit.

## 10. Testing

- Unit tests (`node --test`): every field type (validate, normalise, convert, filter SQL), formula parser and evaluator, query builder, impact analysis, snapshot builder, copy planner.
- Database harness with PGlite (pattern of the old `verify-operations-completion-db.mjs`): `workspace_command` permissions, revisions and conflicts, idempotency, unique values, link scope, undo, trash restore and purge, the retirement migration.
- Lint touched files; production build at the end.
- The user runs `npm run db:push` and checks the UI (Claude does not screenshot UI).

## 11. Out of scope for Foundation

Custom pages, calendar and timeline views (2); stages, approvals, review, automation, emails (3); portals, outside people, per-object roles (4); scheduler, placement, scanner attendance (5); PDFs and certificates (6); code steps, API, webhooks (7); template content (8). Live multi-user sync, offline use and mobile are not planned in any sub-project yet.
