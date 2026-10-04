# Complete event operations implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development, adapted to the user's explicit request for parallel work with disjoint file ownership.

**Goal:** Implement all remaining operational back-office items identified in the repository assessment.
**Architecture:** Typed native rows share A1 entity identity; event-locked database commands atomically enforce revisions, scope, audit and receipts. Staff APIs and verified portal projections expose bounded DTOs; UI, services and persistence work in parallel against the written contract.
**Tech Stack:** Next.js 16.3, React 19, @geiger/ui, Supabase PostgreSQL, Node tests, isolated PGlite.
**Spec:** ../specs/2026-10-02-operations-complete-design.md

## Global constraints

- Preserve all pre-existing local RBAC fixes and unrelated work. Work on codex/operations-complete, no push/deployment/live database writes or real emails.
- Shared contracts and limits in the spec bind each task. Read installed Next route/client guides before edits. Use existing dependencies.
- Separate file ownership; no worker edits another worker's files. No worker spawns agents or commits shared changes.
- Write meaningful tests first, verify missing behavior, implement, run focused tests and report evidence.
- No arbitrary JavaScript/SQL/expression execution, no public operational records, no email-based identity merge.

## Review focus

Revoked portal access during concurrent mutation; rescheduling that conflicts after assignments exist; stale publication acknowledgements; unknown provider outcome after lease expiry; stale UI response/draft loss when switching events. Each owner includes tests for its respective boundary.

## Task 1: Native persistence and atomic workflow (database agent)

Own supabase/migrations/20261002090000_operations_workflow.sql and scripts/verify-operations-workflow-db.mjs only.

- [ ] Write isolated SQL fixture tests for typed entity registration, scope FKs, transactions/replay/revisions, parent/room/person conflicts, grants/invite acceptance/revocation, immutable releases/submissions, corrections/tasks, due notices/leases and role-write prerequisites.
- [ ] Run with the existing external PGlite runtime and record the missing-feature failure.
- [ ] Implement schema, RPCs and SQL command branches from shared contract, applying migration only in isolated fixture.
- [ ] Run harness, inspect all outcomes, report schema/RPC interfaces and review concerns.

## Task 2: Services, routes and external access (API agent)

Own lib/operations/workflow/, lib/operations/server/workflow_store.js, app/api/events/[eventId]/operations/workflow/, app/api/portal/operations/, lib/operations/portal/ and their tests only.

- [ ] Write service/route tests validating full command contracts, authorization, same-event references, invite principal handling, portal projections, scoring and atomic store invocation.
- [ ] Verify tests fail because implementation is missing, then implement service/store/routes aligned with Task 1 RPCs.
- [ ] Implement explicit workflow enablement using A1 save/publish and native definitions; keep existing unsaved draft safe.
- [ ] Run focused tests; report any SQL contracts or UI contracts that need controller integration.

## Task 3: Complete staff and participant screens (UI agent)

Own components/internal/screens/operations/workflow*.jsx, workflow UI helper files, and app/operations/[eventId]/page.jsx plus portal child UI files only.

- [ ] Read current workspace and design/React skills; implement reusable private client transport in workflow-specific helper if needed.
- [ ] Write client-state/submission tests for conflict preservation, event switch and uncertain retries, run red, then build all working action controls from the contract.
- [ ] Build presenter/evaluator/staff restricted portal and invitation acceptance state; mark missing backend configuration accurately.
- [ ] Run UI helper tests and focused ESLint; report exported WorkflowPanel interface for controller wiring.

## Task 4: Integration, notices, reports and readiness (controller)

Own native registry/contracts integration, workspace_section.jsx wiring, generic record native guard, outbox worker/internal route/CLI, export CSV route, operational documentation and verification fixtures.

- [ ] Implement native definitions and guard generic writes with failing tests first; wire UI exports.
- [ ] Implement lease-aware worker, secret-protected scheduler route and CLI; test ambiguous/provider failures without real sends.
- [ ] Implement authorization-scoped CSV reports and formula injection protection; test real projection.
- [ ] Integrate all agent results, run full Node suite, both SQL harnesses, touched ESLint, git diff --check and production build.
- [ ] Independently review database/API/UI and correct important findings; run isolated browser acceptance if runtime is available and record exact limits if external rollout checks remain unavailable.
- [ ] Update completion documentation with actual scope and tests; leave migrations ready for review without live deployment.
