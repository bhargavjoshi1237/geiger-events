# Operations Workspace Completion Implementation Plan

> Executed inline in the authoring session (the user asked for no subagents). Steps use checkbox syntax for tracking. UI code is written during execution against the conventions below rather than pre-written here.

**Goal:** Ship the event Operations workspace as a finished organiser product: rebuilt UI, passwordless participant portal, room chairs, closing, automatic actions, delivered notices, presenter files, templates and a public programme.

**Architecture:** Keep the existing server contract (`/api/events/[eventId]/operations/*`, `ops_workflow_command` single transactional RPC, portal routes). One new migration replaces `ops_workflow_command`/snapshot and adds columns, tables and public/self-service functions. The UI moves from one editor section to an **Operations** sidebar group of eight sections sharing one per-event workflow store.

**Tech Stack:** Next.js 16 App Router, React 19, `@geiger/ui` (DataTable, Sheet, Select, Switch, SegmentedTabs, Toolbar, StatusPill, EmptyState, LogoLoading), Supabase Postgres (events schema), node:test.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-13-operations-workspace-completion-design.md`.
- No internal vocabulary in UI copy: revision, command, entity, principal, UUID, payload, snapshot.
- No glows, gradients, eyebrow labels, hero panels; flat suite styling; tabs + filters + search share one Toolbar row.
- `LogoLoading` for section loaders (40–56px), `Loader2` spinner on buttons.
- Never patch local `components/ui/*`; import from `@geiger/ui`.
- Always build links with `NEXT_PUBLIC_BASE_PATH`; never bare `fetch("/api/…")`.
- Don't commit or push; the user runs `npm run db:push`.
- New RLS/grants: service-role only for ops tables; only `ops_public_programme` is anon-executable.

---

### Task 1: Completion migration

**Files:** Create `supabase/migrations/20261113120000_operations_completion.sql`

- [ ] Columns: `ops_workflow_state.closed_at timestamptz`, `ops_workflow_state.automation jsonb not null default '{"notifyOnPublish":true,"remindOverdue":false,"absentTask":true}'`; `ops_resources.chair_person_id uuid` (composite FK to ops_people); `ops_cycles.min_evaluations integer not null default 1 check (1..50)`; `ops_evaluations.comment text default '' (<=10000)`; `ops_attendance_revisions.reason text default ''`; allow `ops_attendance.status` to stay present/absent/excused (clearing deletes the current row after writing a revision with status `cleared`; extend revisions check).
- [ ] Tables: `ops_files` (id, project_id, event_id, person_id, activity_id null, path, name, size, mime, uploaded_by_kind, created_at, deleted_at), `ops_templates` (id, project_id, name, description, modules jsonb, created_by, created_at, deleted_at); RLS on, service-role only.
- [ ] Storage bucket `operations` (private, 50 MB).
- [ ] Replace `ops_workflow_command` with: closed guard (all but `reopenOperations`), new actions `closeOperations`, `reopenOperations`, `saveAutomation`, `clearAttendance`, `deleteTask`, `revokeAccess` (revokes identity link + pending invitations); `saveResource.chairPersonId`; `saveCycle.minEvaluations`; `saveEvaluation.comment`; `markAttendance.reason` required when changing an existing mark; portal `markAttendance` allowed for chair of the effective room; `releaseResults` enforces min evaluations; absent-task and publish notices gated by automation.
- [ ] Replace `ops_workflow_snapshot` to add `closedAt`, `automation`, `files`.
- [ ] `ops_workflow_reissue_link(p_event uuid, p_email text, p_token_hash text)` → `{ok, personId, email, name}` creating a fresh 14-day invitation for a person in the event with that email (revokes older pending ones).
- [ ] `ops_workflow_open_link(p_token_hash text)` → `{projectId, eventId, email, name, invitationId}` for a live invitation (used before session creation).
- [ ] `ops_workflow_queue_overdue()` → queues overdue reminders for every event whose automation.remindOverdue is true; returns count.
- [ ] `ops_public_programme(p_event uuid)` (anon) → latest release projection only when event is published and `meta.scheduleSource = 'programme'`.
- [ ] Verify: `node scripts/verify-operations-workflow-db.mjs` style harness unavailable without PGlite → static review + user `db:push`.

### Task 2: Service and validation

**Files:** Modify `lib/operations/workflow/validation.js`, `lib/operations/workflow/service.js`, `lib/operations/portal/projection.js`; tests in `lib/operations/workflow/service.test.js`, new `lib/operations/workflow/completion.test.js`.

**Produces:** payload keys for new actions; `authorizePortal` chair rule; snapshot fields `closedAt`, `automation`, `files`, resources `chairPersonId`, cycles `minEvaluations`, evaluations `comment`; `aggregateResults` uses `approvedFeedback || comment`; `projectPortalWorkflow(snapshot, principal|{personId})` exported for role preview.

- [ ] Failing tests: chair can mark attendance for room activity; non-chair cannot; closed snapshot rejects mutations except reopen; correction needs reason; min-evaluation release refusal surfaced as `release_blocked`; preview projection by personId.
- [ ] Implement; run `node --test lib/operations` → all pass.

### Task 3: Notices delivery

**Files:** Create `lib/operations/notifications/email.js` (+ test); modify `worker.js`, `app/api/internal/operations/notices/route.js` (GET for Vercel cron, Bearer `CRON_SECRET` or `OPERATIONS_WORKER_SECRET`), `app/api/events/[eventId]/operations/workflow/route.js` (after() drain), `vercel.json` (daily cron).

**Produces:** `renderOperationsEmail(notice, { baseUrl, accessUrl })` → `{subject, html}`; `processOperationsNotices({ limit, baseUrl })`; placement emails include a fresh access link (reissue per notice).

- [ ] Test rendering escapes, placement lists sessions in their timezone, reminder copy; worker uses `html`.

### Task 4: Passwordless access

**Files:** Create `app/api/portal/operations/access/route.js` (GET: open token → find/create portal member → session cookie → accept invitation → redirect), `app/api/portal/operations/access-link/route.js` (POST {eventId,email}; rate-limited; always 200), `lib/operations/portal/access.js` (+ test). Invitation `invite` result returns `accessUrl` built from base URL.

### Task 5: Presenter files

**Files:** Create `lib/operations/files/service.js`, `app/api/events/[eventId]/operations/files/route.js` (staff list/upload/delete, signed download), `app/api/portal/operations/[eventId]/files/route.js` (presenter upload/list/delete own).

### Task 6: Templates

**Files:** Create `app/api/events/[eventId]/operations/templates/route.js` (GET list project templates + built-in packs, POST save current published modules as template); modify setup flow to accept `templateId`.

### Task 7: Public programme

**Files:** Modify `components/internal/screens/events/schedule.jsx` (source switch), public page schedule renderer, create `app/api/public/events/[eventId]/programme/route.js` (anon RPC) and `lib/operations/public_programme.js` (grouping helper + test).

### Task 8: UI foundation

**Files:** Create `components/internal/screens/operations/state/ops_store.js` (per-event shared workflow + workspace store via useSyncExternalStore, command submit with conflict/uncertain handling), `ops_ui.jsx` (shared bits: SectionShell with closed banner/not-set-up empty state, PersonPicker, SessionPicker, RoomPicker, ContactPicker, TeamMemberPicker, DateTimeField in event timezone, ConfirmReasonDialog, plain-language error text), `format.js` (labels, status maps, time formatting). Modify `event_sections.js` (Operations group, eight items, `showIf` via `ctx.operations`), `event_detail.jsx` (navContext gets ops status).

### Task 9–16: Sections

Setup, People, Programme (schedule grid, sessions, rooms, releases), Evaluations, Attendance, Tasks & notices, Records, Overview — one file per section under `components/internal/screens/operations/sections/`, sub-parts in sibling files when >300 lines.

### Task 17: Participant portal

**Files:** Rewrite `components/portal/operations/operations_portal.jsx`, `operations_auth.jsx` (email-me-a-link), create `portal_presenter.jsx`, `portal_evaluator.jsx`, `portal_chair.jsx`. Preview in Setup reuses these with `readOnly`.

### Task 18: Cleanup and verification

- [ ] Delete superseded UI: `workspace_section.jsx`, `setup_panel.jsx`, `module_editor.jsx` (replaced), `records_view.jsx`/`record_dialog.jsx` (replaced), `workflow_panel.jsx`, `workflow_forms.jsx`, `workflow_evaluations.jsx`, `workflow_import.jsx`, `workflow_history.jsx` once nothing imports them; keep tested pure helpers.
- [ ] Update `docs/operations/foundation.md` → `docs/operations/README.md` with deploy steps (db:push, env, cron).
- [ ] `node --test` (operations), eslint on touched files, `npm run build`.
