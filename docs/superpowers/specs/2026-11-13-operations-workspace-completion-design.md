# Operations workspace: completion and UI rebuild

Date: 13 November 2026 · Status: design approved by the user, implementation in progress
Builds on: [2026-09-30 workspace design](2026-09-30-event-operations-workspace-design.md) (phases A–D backend exist)

## Goal

Turn the event editor's Operations workspace from a developer harness into a shippable organiser product, and finish the remaining research features. Out of scope: abstract submission and peer review (a separate project), offline capture, a general automation builder.

The bar for every screen is: a capable organiser understands it on first use without reading help text. Plain labels, sensible defaults, no internal vocabulary (revision, command, entity, principal, UUID), no AI-slop styling (glows, gradients, eyebrow labels, hero panels).

## 1. Navigation and layout

The single "Operations workspace" editor item becomes an **Operations** group in the event editor sidebar:

| Item | Shown when |
|---|---|
| Setup | always |
| Overview, People, Programme, Evaluations, Attendance, Tasks & notices, Records | the workspace is set up and operations are on |

Each item is an editor section (`EditorSectionHeader`, `Toolbar` with `SegmentedTabs` + filters + search on one row, `DataTable`, `StatusPill`, `EmptyState`, `Sheet` for create/edit). Errors use plain sentences; a stale-write conflict says "Someone else changed this. Reload to see their changes — your edits are kept." No revisions, IDs, JSON or "command" wording reach the UI.

Setting up a workspace now enables operations in the same step (no separate "Enable workflow" button). Starters: Conference, Workshop, Competition, Start empty, plus organisation templates.

## 2. Screens

- **Overview** — six counts, each opens the relevant section pre-filtered: unplaced sessions, schedule conflicts, presenters yet to confirm, absent presenters, evaluations outstanding, notices needing attention. Below: what's on now/next (time-ordered).
- **People** — table (name, email, roles, access status: not invited / invited / active / revoked). Add person sheet with **Add from Contacts** picker (links `contact_id`) or a new name+email. Row actions: send access link (email), copy link, revoke access, link team account (team-member picker, not a pasted ID). Bulk CSV import kept, moved here.
- **Programme** — tabs: **Schedule** (rooms × time grid for a selected day; drag a session to move it, unplaced dock, conflicts outlined with reason), **Sessions** (table + sheet: title, type, room, start/end in the event's timezone, capacity, presenters, room-chair override), **Rooms** (table + sheet: name, kind, capacity, location, availability, room chair), **Releases** (publish bar with change summary since last release, then release history with confirmations per presenter). Accepted-paper import lives on Sessions.
- **Evaluations** — tabs: **Rounds** (rubric editor: criteria, range, weight; minimum evaluations before release; due date; open/close), **Assignments** (who evaluates which session; bulk assign evaluators to all sessions in a room), **Results** (per session: combined score 0–100, submitted/assigned, spread; open a session to see each evaluation, edit the presenter-facing comment, reopen with a reason; release round).
- **Attendance** — pick a room (or all) and day; roster of every presenter on every session with Present / Absent / Excused / Not marked segmented control. Changing an existing mark asks for a reason. History per row.
- **Tasks & notices** — Tasks table (title, person, session, due, status; quick complete). Notices table (recipient, kind, status in plain words, last error, retry). **Automatic actions** card with three switches: email presenters when a programme is published; remind evaluators when an evaluation is overdue (daily); create a follow-up task when a presenter is absent.
- **Records** — custom modules (from starters or organiser-built) with Table / Board / Calendar views; module builder lives in Setup.
- **Setup** — Modules (custom module builder, plain field-type names), **Preview as** (presenter / evaluator / room chair: renders the participant view for a chosen person from staff data, read-only), **Event status** (close operations → everything read-only; reopen), **Templates** (save this workspace as an organisation template), **Delivery** (shows whether email sending and the public link base are configured), Exports.

## 3. Participant portal (`/operations/<eventId>`)

Personal secure links, no passwords. The emailed link opens `/api/portal/operations/access?event=&token=`, which validates the single-use token, finds or creates the portal member for the invited email, starts a 30-day portal session, accepts the invitation and redirects to the portal. A lost or reused link shows "Email me a new link" (rate-limited; only issues a link if the email belongs to a person in this event).

Mobile-first single column, role-aware:
- **Presenter** — My sessions (room, time, what changed since last confirmation), Confirm button per session for the current release, upload slides/materials, released results and comments.
- **Evaluator** — My evaluations list with progress; scoring screen: session details, rubric with large tap targets, private notes, comment for presenter, autosave draft, Submit, next/previous.
- **Room chair** — My room(s), today's sessions, one-tap attendance per presenter.
- Tasks assigned to them.

## 4. Data and backend changes (migration `20261113…_operations_completion.sql`)

- `ops_workflow_state`: `closed_at`, `automation jsonb` (`notifyOnPublish`, `remindOverdue`, `absentTask`, defaults true/false/true).
- `ops_resources.chair_person_id` (room chair). Portal `markAttendance` is allowed for staff assignment on the activity **or** chair of its effective room.
- `ops_cycles.min_evaluations integer default 1`; `releaseResults` refuses while any session with assignments has fewer submitted evaluations than the minimum (unless none are assigned).
- `ops_evaluations.comment text` (evaluator's presenter-facing comment); released results show `approved_feedback` if a chair edited it, else `comment`.
- `ops_attendance`: corrections require `reason` when changing an existing mark; stored on the revision. A new `clearAttendance` returns a mark to "not marked" (with reason).
- `ops_files` (presenter materials in private bucket `operations`, signed URLs, 50 MB, pdf/pptx/key/mp4/zip/images).
- `ops_templates` (project-level saved workspace configurations).
- New commands: `closeOperations`, `reopenOperations`, `saveAutomation`, `clearAttendance`, `saveRoomChair` (via `saveResource.chairPersonId`), `deleteTask`. All commands except reopen are rejected while closed.
- `ops_workflow_reissue_link(project, event, email, token_hash)` for self-service links.
- `ops_public_programme(event_id)`: anon-callable, returns the latest release only as `{ title, kind, startsAt, endsAt, timezone, room, presenters[] }` when the event is published and its schedule source is `programme`.
- Workflow snapshot adds `closedAt`, `automation`, `files`, resource `chairPersonId`.

`ops_workflow_command` is replaced in full by the migration (same contract, extended).

## 5. Notices

Emails are rendered locally (HTML, like the RFP emails) and sent through `sendSuiteEmail` with `html`. Delivery: after a command that queues notices, the route schedules `after()` to drain up to 5 due notices; a daily Vercel cron (`/api/internal/operations/notices`, `CRON_SECRET` or `OPERATIONS_WORKER_SECRET`) drains the rest and queues overdue-evaluation reminders for events with that switch on. Link base: `GEIGER_OPERATIONS_PUBLIC_URL`, falling back to the request origin + basePath. Placement emails carry a fresh personal access link.

## 6. Public agenda

The event's Schedule section gets a source switch: **Your items** (current behaviour) or **Published programme**. With the latter, the public page renders `ops_public_programme` grouped by day, showing time, title, room and presenter names.

## 7. Error handling

Every mutation keeps the user's input on failure. Conflicts → reload prompt. 403 → "You don't have permission to change operations for this event." Closed → banner "Operations are closed" with Reopen (managers). Network → retry. The uncertain-outcome path retries the same command automatically once, then shows "We couldn't confirm that saved — Retry".

## 8. Testing

Keep the existing 98 node tests passing; add tests for new validation, room-chair authorization, min-evaluation release, closed state, attendance correction reason, public programme projection, email rendering and preview projection. Lint touched files; production build at the end. The user runs `npm run db:push` and checks UI.
