# Workspace — Process & automation (sub-project 3 of 8)

Date: 14 November 2026 · Status: decided by Claude under the user's standing instruction ("complete the remaining things", auto mode); open to review
Builds on: [Foundation](2026-11-14-workspace-foundation-design.md), [Portals](2026-11-14-workspace-portals-design.md)

## Goal

Make a workspace *run itself*: records move through stages with rules about which moves are allowed, peer review is assigned and scored without spreadsheets, approvals reach the right people, and "when X happens, do Y" rules handle the busywork (emails, follow-up records, reminders). Everything that runs is logged.

## Decisions

| Topic | Decision |
|---|---|
| Stage rules | Per list, opt-in. Allowed moves are `from → to` pairs plus "fields required to enter" a stage. Enforced on the server for staff, portal, automations and the API. Staff who can configure may **move anyway** (logged as forced). |
| Automations | Trigger → optional condition (the existing filter format) → ordered steps. Stored as rows; edited in the dashboard only. |
| Event source | The change log. A trigger on `workspace_changes` queues every record change for the event's automations, so staff edits, portal edits, imports, bulk edits and automation edits all fire the same way. Undo does not fire automations. |
| Who automations act as | A **system actor** (`actor_kind = 'automation'`, actor id = the automation). They don't depend on a staff member keeping access. Activity shows "Automation · *name*". |
| Loops | Changes made by an automation carry a depth. At depth 3 the run is skipped and logged as "Stopped a loop". |
| Timing | Instant triggers run right after the request that caused them (`after()`). Delays, schedules and date triggers are picked up by a processor that runs after workspace requests, from the daily cron, and from `/api/internal/workspace/automations` (CRON_SECRET) for anyone who wants a minute-level external pinger. The UI says this plainly. |
| Delivery | At least once, idempotent per (automation, queue item); each step's email uses an idempotency key. Failed queue items retry twice with back-off, then show as failed with a Retry button. |
| Emails | Event-branded HTML through the suite email API (same layout as portal emails). Recipients: an email field, an email reached through one link, team members, or fixed addresses. No attachments (the email API has none) — documents go out as links (sub-project 6). |
| Approvals | A step ("Ask for approval") creates an approval for chosen team members (any one / everyone). The decision applies an outcome (status and values) as the system actor. Approvers get an email and an **Approvals** screen with a badge. |
| Review | A **review setup** connects a submissions list, a reviews list and a reviewer pool. It assigns N reviewers per submission with topic matching, load limits and conflict-of-interest rules (preview first, then apply), scores with a weighted rubric over the reviews list's fields, and shows results with disagreement flags. Blind review stays a portal-role concern (hidden fields), already built. |

## Data model (migration `20261116100000_workspace_process.sql`)

- `actor_kind` on changes, comments and receipts also allows `automation` and `api` (the API arrives in sub-project 7).
- `workspace_processes (object_id pk, project_id, event_id, config, revision, updated_by, updated_at)` — `config = { enforce, moves: [{ from, to }], requires: { <status>: [fieldId] } }`. `from` may be `null` for "a new record may start here"; when there are no moves into a status from `null`, creating straight into it is refused while enforced.
- `workspace_automations (id, project_id, event_id, name, description, enabled, trigger, condition, steps, hook_token_hash, next_run_at, cursor, position, revision, created_by, created_at, updated_at, deleted_at)`.
- `workspace_queue (id, project_id, event_id, kind, automation_id, change_id, record_id, payload, depth, due_at, status, attempts, locked_until, last_error, created_at, updated_at)` — kinds: `change`, `schedule`, `date`, `resume` (after a wait), `manual`, `hook` (sub-project 7), `checkin` (sub-project 5).
- `workspace_runs (id, project_id, event_id, automation_id, queue_id, record_id, status, trigger, steps, error, depth, started_at, finished_at)`, unique `(automation_id, queue_id)`; statuses `running | succeeded | failed | skipped | waiting`.
- `workspace_approvals (id, project_id, event_id, record_id, automation_id, run_id, title, message, approvers uuid[], rule, decisions, outcomes, status, created_at, decided_at)`.
- `workspace_review_setups (id, project_id, event_id, name, config, revision, created_by, created_at, updated_at, deleted_at)`.
- Functions:
  - `events.workspace_system_command(p_project, p_event, p_kind, p_actor, p_depth, p_command)` — record create/update/delete and comments as the system actor; same integrity helpers and receipts as the staff and portal commands; sets `workspace.actor_kind` and `workspace.depth` for the change trigger.
  - `events.workspace_queue_claim(p_limit, p_lease_seconds, p_project, p_event)` — leases due items (`for update skip locked`); re-leases items whose lease expired with fewer than 3 attempts.
  - Trigger `workspace_changes_enqueue` — after insert of a record change (not an undo) queues a `change` item when the event has an enabled record-triggered automation.

All tables: RLS on, service role only.

## Triggers

| Kind | Fires when | Options |
|---|---|---|
| `record.created` | A record is added to the list | Source: anyone / portal / team |
| `record.updated` | A record changes | Only when one of chosen fields changes |
| `status.changed` | The status changes | From (any or chosen), to (any or chosen) |
| `schedule` | Every day / weekday / week at a time (event time zone) | Optional list + condition: runs once per matching record; otherwise once |
| `date` | A date field on each record reaches an offset | Field, days before/after, time of day |
| `manual` | Staff press **Run** on a record or a selection | — |
| `hook` | A POST to the automation's secret address `/events/api/v1/workspace/hooks/<automationId>/<token>` (built here, so it sits under the already-public `/api/v1`) | Optional list: runs on `payload.recordId` |
| `checkin` | A ticket holder checks in (sub-project 5) | — |

## Steps

`update_record` (values and/or status on the trigger record) · `update_linked` (records reached through a link field) · `create_record` (any list, values from fixed values or placeholders, optional link back) · `send_email` · `ask_approval` · `assign_reviewers` (runs the review setup for this record) · `add_comment` (internal note) · `wait` (minutes / hours / days) · later: `generate_document` (6), `upsert_record` (5), `webhook` and `run_code` (7).

Placeholders use `{{Field name}}` in the editor and are stored as `{{field_key}}`, plus `{{record.number}}`, `{{record.title}}`, `{{record.status}}`, `{{record.link}}` (portal address), `{{event.name}}`, `{{today}}`, and one hop through a link: `{{link_key.field_key}}`. One renderer (`lib/workspace/process/template.js`) serves emails, comments, values and later documents.

## Code layout

```
lib/workspace/process/
  stages.js        validate a stage config; allowed moves; check a move (pure, tested)
  triggers.js      trigger catalog, validation, change matching, next schedule time (pure, tested)
  steps.js         step catalog and validation (pure, tested)
  template.js      placeholder rendering (pure, tested)
  assign.js        reviewer assignment and rubric scoring (pure, tested)
  store.js         tables above + system commands
  engine.js        claim → match → condition → steps → run log
  service.js       config writes, runs, approvals, review (routes call this)
app/api/events/[eventId]/workspace/{process,runs,approvals,review}/route.js
app/api/internal/workspace/automations/route.js
components/internal/screens/workspace/process/   Automations (+ Runs), Approvals, Review, Stage rules sheet
```

## UI

- Workspace sidebar gains **Automations**, **Approvals** (count of mine pending) and **Review** (when a setup exists or the user can configure).
- **Automations**: Toolbar with tabs *Automations · Runs* on the left and search/filters on the right (one row). Each automation is a row: switch, name, "When … → n steps", last run status. The editor is a sheet: *When* (trigger), *Only if* (the existing filter builder), *Do* (step cards with an Add step menu), *Run on a record* to try it.
- **Runs**: table of runs (status, automation, record, started, duration); a run sheet lists each step's outcome and error; failed runs have Retry.
- **Stage rules**: from the list's edit-structure menu; a from → to grid of checkboxes, "required to enter" fields per stage, and an Enforce switch. Status pickers everywhere (record sheet, board, bulk bar, portal) offer only allowed moves when enforced.
- **Approvals**: pending (assigned to me first) and decided; approve or reject with a note; the record opens in the record sheet.
- **Review**: setup sheet (lists, link fields, pool + condition, reviewers per submission, max per reviewer, topic fields, conflict rules, rubric weights); results table (reviews done/assigned, weighted average, spread, flag); **Assign reviewers** opens a preview (proposed pairs, unfilled slots with reasons) and applies it.

## Errors

- A move that isn't allowed: `409 move_not_allowed` naming the allowed next stages; staff with configure get **Move anyway** (`force: true`).
- Missing required fields for a stage: `422 invalid_input` with per-field messages.
- A step that fails stops its run (`failed`), records the error and leaves earlier steps' effects in place (they are logged changes and can be undone individually).

## Testing

- Unit: stages, triggers (matching + schedule times across DST), steps validation, template rendering and escaping, assignment (load, conflicts, topics, determinism), rubric scoring.
- PGlite: system command (create/update/comment/receipts/actor kind), queue trigger, claim leasing, enforcement guard via revision.
- Lint touched files; build at the end. The user runs `npm run db:push`.

## Out of scope

Visual flow-chart editing (steps are a list), branching inside one automation (use two automations with conditions), SMS/WhatsApp, per-step retries.
