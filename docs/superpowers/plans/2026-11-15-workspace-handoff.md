# Workspace completion — handoff (2026-11-15)

You are continuing the per-event **Workspace** platform in `C:\Pro\geiger-events`. The roadmap has 8 sub-projects:

- **Done earlier:** Foundation (1) and Portals (2+4).
- **Mostly written:** Process & automation (3).
- **Not started:** Documents (6), Event components (5), Code & openness (7), Templates (8), in that build order.

The owner gave standing permission to design and build all of it without asking. You make the decisions, record them in the spec, and keep going.

## Read first

1. `CLAUDE.md`, `AGENTS.md` and the convention files they import. **Next.js 16 differs from your training data:** read `node_modules/next/dist/docs/` before using any Next API (for example, `params` is a Promise).
2. The specs in `docs/superpowers/specs/2026-11-14-workspace-*-design.md`. Each one lists the decisions already made: process, documents, event-components, code-openness, templates. The foundation and portals specs give background.
3. The checklist `docs/superpowers/plans/2026-11-14-workspace-completion.md`. No boxes are ticked yet. Tick each one as you finish it.
4. `docs/workspace/README.md` (architecture), plus `lib/workspace/**` and `components/internal/screens/workspace/**`.

## Hard rules

- **Git:** never commit or push. The owner will say when.
- **Database:** never touch the production database. Write migrations under `supabase/migrations/`; the owner runs `npm run db:push`. If you edit only the `-- @down` sections, that doesn't count as drift.
- **Screenshots:** don't screenshot or browser-test the UI yourself. Lint the files you touched and let the owner report UI issues.
- **Look:** flat suite UI. No glows, gradients, grid backdrops, pulsing dots, eyebrow labels or hero panels.
- **Components:**
  - Use `@geiger/ui` components and lucide icons. Never patch a local `components/ui/*` fork.
  - Shared screen pieces come from `@/components/internal/shared/screen_kit`: `Toolbar`, `SegmentedTabs`, `DataTable`, `EmptyState`, `EditorSectionHeader`.
- **Loaders:** use `LogoLoading` (no `name` prop) for page, section and dialog-body loaders, and `Loader2 animate-spin` on buttons.
- **Toolbars:** tabs and their filters share one `Toolbar` row (tabs left, filters right). Never stack them.
- **Comments:** concise single-line comments only.
- **Client fetches:** go through `request()` in `lib/workspace/client.js` or `portalFetch`. The basePath is `/events`, and a bare `fetch("/api/...")` breaks in production.
- **New logged-out routes:** geiger-dash only lets through allowlisted prefixes. Editing that list needs the owner's go-ahead.
  - Already public: `/events/e/`, `/events/api/v1/`, `/events/api/portal/`.
  - Put new public endpoints under one of those.
- **Cron:** Vercel Hobby allows a daily cron only. Don't add more frequent crons.
- **Bash heredocs:** they fail when the body contains an apostrophe. Use Write or Edit, or a Python script in the scratchpad.
- **Build:** run one production build only at the very end (`npm run build`).

## How the existing pieces work (reuse them)

- **Record writes:** all go through the SQL command functions (`lib/workspace/server/send.js` `commandSender`, `stableId`). Automations, approvals and the API write as a system actor via `events.workspace_system_command(p_project, p_event, p_kind 'automation'|'api', p_actor, p_depth, p_command)`. Loops stop at depth 3.
- **Change log and queue:**
  - `events.workspace_changes` triggers enqueue `workspace_queue` items.
  - `lib/workspace/process/engine.js` claims items (`workspace_queue_claim`, skip-locked lease, 3 attempts) and runs automations.
  - `lib/workspace/process/after.js` `processAfter(context)` runs the queue after a response.
  - The daily maintenance cron and `/api/internal/workspace/automations` (CRON_SECRET bearer) also run it.
- **Stage rules:** `lib/workspace/process/stages.js` provides `allowedMoves` and `checkMove`.
  - Enforced in `lib/workspace/server/service.js` (`guardMove`), `lib/workspace/portal/write.js` and the engine.
  - A refused move returns 409 `move_not_allowed` with `fields.allowed`. Staff who can configure may resend with `force: true`.
  - `use_workspace.js` `runAction` shows a "Move anyway" toast.
- **Placeholders:** `lib/workspace/process/template.js`. The editor writes `{{Field name}}`, which is stored as `{{field_key}}`. It supports one link hop, `record.*`, `event.name`, `today`, `now` and `payload.*`. `renderTemplate(text, resolve, { html })`.
- **Email and branding:**
  - `sendSuiteEmail({ template, to, subject, html, idempotencyKey })` from `lib/email/client.js`.
  - `emailLayout` from `lib/workspace/portal/emails.js`.
  - `brandColor(eventRow)` from `lib/workspace/portal/staff.js`.
- **Time:** `lib/venue_booking/time.js` provides `toWall`, `fromWall`, `zonedInstant`, `todayIn`, `addDays`, `parseClock` and `parseDateString`.
- **Public API:**
  - `apiRoute(scope, handler)` in `lib/api_webhooks/server/public_api.js`.
  - Keys are `gev_live_…`; scopes are in `API_SCOPES`, and there is an `api_keys.scopes` check constraint.
  - Webhooks are sent with `events.webhook_emit(project, type, data)` and listed in `WEBHOOK_EVENT_TYPES`.

## State of sub-project 3 (Process & automation)

Written, lint-clean, and 401 lib unit tests pass (`node --test "lib/**/*.test.js"`). Not yet built or browser-tested.

- **Migration:** `supabase/migrations/20261116100000_workspace_process.sql` has **not been pushed** yet. The owner must run `npm run db:push`.
- **Lib** (`lib/workspace/process/`):
  - pure modules: `stages`, `triggers`, `steps`, `template`, `assign`, plus `process.test.js`
  - data access and orchestration: `records`, `review`, `store`, `emails`, `engine`, `service`, `after`
  - browser client: `client.js`
- **Routes** under `app/api/events/[eventId]/workspace/`: `process`, `runs`, `approvals`, `review`. Also `app/api/internal/workspace/automations`.
- **UI** (`components/internal/screens/workspace/process/`):
  - screens: Automations (with Runs), Approvals, Review
  - sheets and dialogs: the automation editor, the Stage rules sheet, the review setup sheet
  - in other files: nav items in `nav.jsx`, sections in `workspace_section.jsx`, and a "Stage rules" button in `object_screen.jsx`
- **Hidden steps:** `generate_document`, `webhook` and `run_code` are removed from `STEP_KINDS` in `steps.js`. Their engine executors throw "not available yet". `send_email` with `templateId` also throws. Re-enable each one when its sub-project lands. `updateRecordFromCode` in `engine.js` is kept for `run_code`.
- **Done in the last session, not yet linted:**
  - `processService.hookAddress` and `receiveHook` (sha256 token hash, `timingSafeEqual`).
  - The `automation.hook` action in the process route.
  - The engine runs hook payloads per record when the trigger has a list and `payload.recordId` is given.
  - New public route `app/api/v1/workspace/hooks/[automationId]/[token]/route.js` (64 KB cap, JSON or form body, returns 202). This deliberately replaces the spec's `/api/hooks/workspace/...` path so it sits under the already-public `/events/api/v1/`. **Update the process and code-openness specs to match.**

### Unfinished edit — fix this first

`components/internal/screens/workspace/record/record_sheet.jsx` has new imports that nothing uses yet, so lint fails. The unused names are:
- `Play`, `DropdownMenu*`, `toast`, `allowedMoves`, `RunBadge`, `useProcess`
- the `APPROVAL` constant

Finish the integration:

- **Process data:** in `RecordSheetBody`, call `const process = useProcess(eventId)`.
- **Allowed status options:**
  - Compute `allowed = allowedMoves(process.processes[objectId], object, isNew ? null : record?.status ?? null)`.
  - Mark a status option as blocked when it's not allowed and not the current status. Hide blocked options from people without `can.configure`. For people with it, show them with a muted "skips the stage rules" note.
  - Hide "No status" when rules are enforced, unless it's the current status.
- **New records:** derive the status as `allowed[0]` when the draft status isn't allowed. Don't add an effect.
- **Save errors:** handle `invalid_values`, `invalid_input` (map `error.fields` to the field errors) and `move_not_allowed` (a toast with a "Move anyway" action that re-saves with `force: true`).
- **Run menu:** a dropdown in the footer listing enabled `manual` automations for this list, shown when `can.update` is true. Each calls `process.api.command({ action: "automation.run", id, recordIds: [recordId] })`, toasts the first run's status, then reloads the record.
- **Activity tab:** load `process.api.recordContext(recordId)` when the tab opens. List automation runs (`RunBadge`, automation name, time, error) and approvals (title plus status text from `APPROVAL`) alongside comments and changes.

### Other leftovers for sub-project 3

- Extend `scripts/verify-workspace-db.mjs`, or add `scripts/verify-workspace-process-db.mjs` modelled on `verify-workspace-portal-db.mjs`. It runs the migrations on PGlite. Assert:
  - the actor-kind widening;
  - the enqueue trigger (record.create/update only, no undo rows, only when an enabled change automation exists);
  - `workspace_queue_claim` leasing and attempts;
  - `workspace_system_command` depth and actor;
  - `workspace_approval_decide` (any/all rules, double decisions);
  - housekeeping.
- Add a Process section to `docs/workspace/README.md`. Update the memory note `workspace-platform.md` in `C:\Users\space\.claude\projects\C--Pro-geiger-events\memory\`.

## Remaining sub-projects (in this order; each spec has the decisions)

1. **Documents (6)**
   - **Dependencies:** `npm i pdf-lib @pdf-lib/fontkit`. Add Noto Sans and Noto Serif TTFs under `lib/workspace/documents/fonts/`.
   - **Migration** `20261117100000_workspace_documents.sql`: tables `workspace_documents` and `workspace_certificates`.
   - **Lib:** `model.js` and `layout.js` (pure, tested), then `render.js` and `service.js`.
   - **Routes:** list, save, render/preview and generate. `lib/workspace/documents/client.js` already exists and expects these.
   - **Certificates:** codes look like `ABCD-EFGH-JKLM`. Public verify page at `app/e/[id]/verify/[code]/page.js`.
   - **Re-enable** `generate_document`, the `send_email` template option and the attachment link (`components/internal/screens/workspace/process/use_documents.js` exists).
   - **UI:** a Documents screen (Templates and Certificates tabs), a template editor with PDF preview, and a Documents menu on the record sheet.
2. **Event components (5)**
   - **Pure modules:** `lib/workspace/components/{schedule,placement,pass}.js`, with tests.
   - **Portal blocks:** add `schedule`, `timeline`, `placement`, `scanner` and `pass` everywhere blocks are defined: validators and defaults (`lib/workspace/portal/blocks.js`), reads, writes (`scan.mark`), renderers (`components/workspace_portal/render/`) and inspector settings.
   - **Calendar:** a `startDate` setting.
   - **Pass QR:** `ws1.<eventShort>.<recordId>.<hmac>`.
   - **Event links:** richer ticket and order link chips, and "Match tickets by email".
   - **Check-in trigger:** a trigger on `events.checkin_attendance` that enqueues `checkin` items (migration `20261118100000_workspace_components.sql`). The `upsert_record` step already exists.
3. **Code & openness (7)**
   - **Sandbox:** `npm i quickjs-emscripten-core @jitl/quickjs-singlefile-cjs-release-sync@0.32.0`. Build `lib/workspace/code/sandbox.js`, with tests, and re-enable the `run_code` step and its editor.
   - **Custom block:** runs in a sandboxed iframe (srcdoc, CSP `connect-src 'none'`) with a `window.geiger` bridge, plus an inspector.
   - **API:** add scopes `read:workspace` and `write:workspace`, and routes under `/api/v1/workspace/...` built with `apiRoute`.
   - **Outgoing webhooks:** types `workspace.record.created/updated/deleted` and `workspace.status.changed`, sent with `webhook_emit`. Re-enable the `webhook` step.
   - **Migration** `20261119100000_workspace_openness.sql`.
4. **Templates (8)**
   - **Installer:** builtin key-based modules in `lib/workspace/templates/`, installed through the normal services, with a dry-run validation test.
   - **Five templates:** research conference, hackathon, exhibitors, volunteers and awards. The acceptance test is building each with no code.
   - **Snapshot and carry-over:** extend `lib/workspace/carryover/snapshot.js` to include the process, automations, review setups, documents and the portal draft.
   - **Setup gallery:** add it to `setup_screen.jsx`.
   - **Showcase seed:** update `scripts/seed-workspace-showcase.mjs` (ICAML).

## Finish

- Run the unit tests (`node --test "lib/**/*.test.js"`), the PGlite verify scripts, and `npx eslint` on every touched file.
- Run one `npm run build`.
- Tick the plan checkboxes and update `docs/workspace/README.md` and the memory notes.
- Tell the owner which migrations need `npm run db:push`: `20261116100000`, `20261117100000`, `20261118100000`, `20261119100000`.
- Do not commit.
