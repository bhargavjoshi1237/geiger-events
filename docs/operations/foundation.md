# Event Operations foundation (A1)

This release adds an optional, private organiser workspace to each event. An event without a workspace continues to use its existing editor and public pages. Admins and managers with a live event-scoped role grant can create a draft from a conference, workshop or competition reference pack, or start empty. The same module and record engine handles all packs and organiser-defined modules; event type names never branch the core service.

## Deploy and pilot

Apply the ORM migrations in filename order:

1. `20260930160740_operations_foundation.sql` — private workspaces, immutable published versions, module instances, event-scoped entities, links, audit and idempotent command receipts.
2. `20260930163920_operations_permission_backfill.sql` — adds the new action keys to existing system Admin/Manager roles. It does not widen Member or custom roles.
3. `20260930165200_operations_record_reads.sql` — private, event-scoped paginated reads.

The service-role key stays server-side. Tables and routines deny `anon` and `authenticated` direct access; authenticated clients use the staff API after Supabase `auth.getUser` verification, project membership and a fresh `@geiger/rbac` decision. Portal sessions do not confer staff access. Verify the deployed suite's `public.roles` and `events.role_grants` write policies with pilot accounts before inviting a team; role template updates do not replace role-write policy verification.

The entry is available in the event editor, but no event receives a workspace automatically. In an isolated/pilot database, apply migrations, create a dedicated opted-in event, and exercise all three packs plus a custom module. Test with an owner or manager, an ordinary member, a revoked grant and an event-scoped grant for a different event. Inspect the public event payload to confirm it contains no operational records. Do this browser acceptance before enabling a real event; it has **not** been run against a migrated live database as part of this implementation.

## Model and access

The five event-scoped action keys are `events.operations.view`, `events.operations.configure`, `events.operations.records.create`, `events.operations.records.update`, and `events.operations.records.archive`. Owner wildcard and the Admin/Manager templates can use them. A1 has no evaluator, reviewer, volunteer or participant write surface. The archive key also gates private history reads. Disabling a module blocks normal reads and mutations, while its records remain accessible in manager history. Archiving a record retains its audit and values.

A module uses a stable key, a version, a source kind (`native` or `custom`), a display label, fields, states, transitions and table/board views. Field and state IDs are stable while labels may change. A1 supports text, textarea, email, number, boolean, select, date and event-scoped reference fields. At most 30 modules, 40 fields per module, 100 select options and 50 records per page are accepted. Request JSON is capped at 256 KiB. Only `records` and `forms` capabilities are implemented; scheduling, assignments, attendance, evaluation, notifications and reporting capability names remain unavailable.

Configuration has a draft revision and immutable published snapshots. Saves and publishes compare expected revisions; stale edits return `revision_conflict` with a current revision when available. A published definition pins records to its version. Nonbreaking additions can publish a new version. Destructive field/state changes with existing records return `migration_required` until an explicit migration is designed. Each record command carries a new UUID command ID and expected revision where applicable; exact retries return the original receipt, while reuse with changed input returns a conflict. Database routines write the mutation, audit entry and receipt in one transaction. Linked records must share project and event, enforced by composite foreign keys.

## API and code ownership

Staff routes live under `/api/events/{eventId}/operations/`. `workspace` supports GET, PUT draft, POST publish and PATCH module archive. `packs` returns the reference templates. `modules/{moduleKey}/impact` shows archive consequences. `modules/{moduleKey}/records` supports paginated GET and POST; the record ID route supports GET, PUT, PATCH transition and DELETE archive. The client transport is `lib/operations/client.js`, domain validation is in `lib/operations/config` and `lib/operations/records`, and database operations are isolated under `lib/operations/server`. No client component imports the server store or service-role key.

The reference packs configure operational records only. Research-paper placement, room assignment, notices to presenters, reviewer attendance and evaluations are **not** implemented by A1. They depend on the later typed people/resource/activity model, assignment and scheduling rules, durable email outbox, attendance evidence and evaluation cycles described in the [workspace design](../superpowers/specs/2026-09-30-event-operations-workspace-design.md).

## Verification and rollback

The local contract suite is `node --test` (179 passing in this implementation). The isolated PostgreSQL harness is `node scripts/verify-operations-db.mjs` with `PGLITE_MODULE` set to an installed PGlite runtime. It checks direct-access denial, parent scope, publication, stale revisions, replay, atomic audit rollback, cross-event links, archive visibility, role backfill and an interleaved create before a breaking publish. The final managed-worktree `npx next build --webpack` passed. A local production-route smoke at `/events/api/...` returned JSON 400 for a malformed event ID and JSON 401 for a valid ID without staff credentials. Full browser flows need the isolated migrated database and staff test accounts described above. Touched-file ESLint passed; repository-wide lint still reports three errors in untouched kiosk, expo and mobile-hook files, also present on baseline `master`. Run `npm run build` and resolve those baseline lint errors in a checkout with local dependencies before release; the managed worktree's external `node_modules` junction requires webpack for its build verification.

Before live use, rollback is limited to leaving the optional workspace unopened. After operational records or audits exist, do not drop the tables or reverse a pilot with a schema rollback alone. Export and preserve workspace versions, entities, links, audit and receipts first; use a reviewed per-event migration or cutover plan. Existing event metadata is not dual-written to these tables.
