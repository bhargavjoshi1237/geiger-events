# Workspace completion (sub-projects 3, 6, 5, 7, 8) Implementation Plan

> Executed inline in one session (auto mode, user instruction "complete the remaining things"). This is the execution checklist; the code is the source of truth. No commits without the user's say-so.

**Goal:** Finish the Workspace roadmap: process & automation, documents, event components, code & openness, templates — plus the timeline block and calendar start date.

**Architecture:** Each sub-project adds pure modules under `lib/workspace/<area>/` (unit-tested with `node --test`), a store/service pair the routes call, one migration, and screens under `components/internal/screens/workspace/<area>/` or blocks under `components/workspace_portal/render/`. All record writes go through the existing SQL command functions (staff, portal) or the new `events.workspace_system_command` (automations, approvals, API).

**Tech Stack:** Next.js 16 App Router, Supabase Postgres (`events` schema, service-role only), `@geiger/ui`, lucide, `pdf-lib` + `@pdf-lib/fontkit`, `quickjs-emscripten-core` + `@jitl/quickjs-singlefile-cjs-release-sync`, existing `qrcode`, `jsqr`.

## Global Constraints

- Never commit or push without explicit instruction; the user runs `npm run db:push`.
- No self screenshots/visual tests; lint touched files; one production build at the end.
- Flat suite UI (no glows, gradients, eyebrow labels); `@geiger/ui` components; `LogoLoading` for section loaders, `Loader2` on buttons; tabs and filters share one Toolbar row.
- Concise single-line comments.
- Client fetches go through the existing `request`/`portalFetch` helpers (basePath).

---

## Sub-project 3 — Process & automation

- [x] **3.1 Migration** `supabase/migrations/20261116100000_workspace_process.sql`: actor kinds, `workspace_processes`, `workspace_automations`, `workspace_queue`, `workspace_runs`, `workspace_approvals`, `workspace_review_setups`, `workspace_system_command`, `workspace_queue_claim`, change → queue trigger, `workspace_process_housekeeping`.
- [x] **3.2 Pure modules + tests** `lib/workspace/process/{stages,triggers,steps,template,assign}.js` and `process.test.js`.
  - `validateProcess(definition, objectId, input) → config`; `checkMove(config, object, { from, to, values, creating }) → null | { code, message, allowed }`.
  - `validateTrigger(definition, input)`, `changeMatches(trigger, change) → boolean`, `nextScheduleAt(trigger, after, timeZone) → Date`.
  - `validateSteps(definition, objectId, steps)`; `STEP_KINDS`.
  - `renderTemplate(text, ctx, { html })`, `templateForEditing`/`templateKeys` (name ↔ key).
  - `assignReviewers({ submissions, reviewers, existing, config }) → { pairs, unfilled }`; `scoreSubmission(reviews, rubric) → { average, spread, done }`.
- [x] **3.3 Store + engine + service** `lib/workspace/process/{store,engine,service,emails}.js`; enforcement wired into `lib/workspace/server/service.js` (record.update, records.bulk, record.create) and `lib/workspace/portal/write.js`.
- [x] **3.4 Routes** `app/api/events/[eventId]/workspace/{process,runs,approvals,review}/route.js`, `app/api/internal/workspace/automations/route.js`, `after()` processing in the staff and portal command routes; `vercel.json` unchanged (maintenance cron also processes due items).
- [x] **3.5 UI** `components/internal/screens/workspace/process/*`: Automations (+ Runs), automation editor, Stage rules sheet, Approvals, Review; nav items; status pickers respect allowed moves; activity shows automation names.

## Sub-project 6 — Documents

- [x] **6.1 Deps + fonts** `npm i pdf-lib @pdf-lib/fontkit`; Noto Sans/Serif TTFs in `lib/workspace/documents/fonts/`.
- [x] **6.2 Migration** `20261117100000_workspace_documents.sql`: `workspace_documents`, `workspace_certificates`.
- [x] **6.3 Pure modules + tests** `lib/workspace/documents/{model,layout}.js`.
- [x] **6.4 Renderer + service + routes** `render.js`, `service.js`, routes for list/save/render/generate, `app/e/[id]/verify/[code]/page.js`; `generate_document` step; `send_email` template option.
- [x] **6.5 UI** Documents screen (Templates · Certificates), template editor with PDF preview, record-sheet Documents menu.

## Sub-project 5 — Event components (+ timeline, calendar start)

- [x] **5.1 Pure modules + tests** `lib/workspace/components/{schedule,placement,pass}.js`.
- [x] **5.2 Blocks** validators/defaults (`schedule`, `timeline`, `placement`, `scanner`, `pass`, calendar `startDate`), reads, writes (`scan.mark`), renderers + inspector settings.
- [x] **5.3 Event data** richer ticket/order link chips, "Match tickets by email", `checkin` trigger (migration `20261118100000_workspace_components.sql`), `upsert_record` step.

## Sub-project 7 — Code & openness

- [x] **7.1 Sandbox** `npm i quickjs-emscripten-core @jitl/quickjs-singlefile-cjs-release-sync`; `lib/workspace/code/sandbox.js` + tests; `run_code` step + editor.
- [x] **7.2 Custom block** bridge + iframe host + inspector.
- [x] **7.3 API + webhooks** migration `20261119100000_workspace_openness.sql` (scopes, webhook emit, hook secret); `/api/v1/workspace/...`; catalog entries; `hook` trigger route; `webhook` step.

## Sub-project 8 — Templates

- [x] **8.1 Template format + installer** `lib/workspace/templates/{installer,builtin/*}.js`, dry-run validation test.
- [x] **8.2 Five templates** research conference, hackathon, exhibitors, volunteers, awards.
- [x] **8.3 Snapshot/carry-over** includes process, automations, review setups, documents, portal draft.
- [x] **8.4 Setup gallery** + showcase seed updated.

## Finish

- [x] Docs (`docs/workspace/README.md`), PGlite verification extended, unit tests, lint, build, memory notes.
