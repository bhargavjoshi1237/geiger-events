# Operations Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an optional, staff-only Event Workspace in which organisers configure bounded custom modules and manage their records through one event-scoped, versioned, audited engine.

**Architecture:** Keep the existing Next.js application and Supabase/Postgres. Compiled module definitions and organiser-authored configuration share a capability contract; a server-only command layer validates and authorizes every operation, with atomic persistence, audit and optimistic revisions. Event packs are copied configuration and contain no executable code.

**Tech Stack:** Installed Next.js 16.3.1, React 19.2.4, JavaScript with JSDoc, `@geiger/ui`, `@geiger/rbac`, Supabase Auth, Postgres, `@geiger/orm`, Node's test runner.

**Spec:** [Event Workspace design](../specs/2026-09-30-event-operations-workspace-design.md). [Research](../../research/2026-09-30-event-operations-products.md).

**Status:** Ready for human review; Operations product implementation has not started. Sponsorship code and its privacy fixes are a separate release.

## Global Constraints

- Core services depend on module/capability contracts, never conference labels or template IDs.
- No parallel CRUD, forms, assignment, audit, export, or access engines for different event packs.
- Small focused files; server/client boundaries are explicit; existing `@geiger/ui` and suite patterns are reused.
- Scope mismatches, unknown capabilities, stale versions, invalid relation targets, and unsupported transitions fail explicitly; they never fall back to broader access or silently drop fields.
- Use existing contacts as the person library and existing project/event IDs as boundaries.
- Read relevant installed Next.js guides in `node_modules/next/dist/docs/` before code changes. Do not assume older Next.js APIs.
- New tables revoke schema default anonymous/authenticated privileges. Operational data never goes in public event metadata.
- Preserve existing ticketing, event pages, sponsorship, agendas, portal sessions and contact screens.
- Use the ORM CLI to create migration files; record its generated filename in this plan when execution starts. Do not run migrations against a shared database as part of tests.
- No new application dependency is required for this subproject. The isolated SQL test runtime may use PGlite outside the application as in the sponsorship verification script.

## Review Focus

1. Two organisations use identical module keys: neither records nor referenced entities cross event/project boundaries. Task 3 database tests and Task 4 authorization tests own this.
2. Another organiser publishes configuration while a draft is open: a stale revision returns 409 and preserves the draft. Tasks 5 and 7 own this.
3. A submitted scalar field contains an object, unknown key or prototype-related key: validation fails with a field error and no mutation. Tasks 1 and 6 own this.
4. A module is disabled after records exist: access is archived while historical versions and data remain available to authorized managers. Tasks 2, 5 and 6 own this.
5. A network request is retried after its transaction committed: the same command ID returns the original response and creates one audit entry. Tasks 3 and 6 own this.

## Scope and sequence

This is **Phase A1**, the first independently deployable part of the larger foundation. It delivers configuration, custom record CRUD, references, lifecycle transitions, table/board views, staff access, revision conflicts and audit. Conference, workshop and competition reference packs exercise the same record engine; they initially configure operational rosters/items, rather than claim scheduling or grading is already implemented.

Phase A2 adds typed people, resources and activities plus the external identity adapter. Phase B adds assignments, schedule conflict rules, publication and durable notices. Phase C adds attendance and evaluation. Phase D adds reporting, pilot import and operational hardening. Each receives its own reviewed implementation plan. Do not expose unavailable capabilities as working controls in A1.

Candidate capability names remain `records`, `forms`, `assignments`, `scheduling`, `resourceReservation`, `attendance`, `evaluation`, `tasks`, `notifications`, `reporting`. A1 only enables record configuration, record edit forms, table/board views and audit. A declared capability is enabled only if a registered implementation exists; unknown or unavailable capabilities fail validation.

## File map

| Files | Responsibility |
| --- | --- |
| `lib/operations/contracts.js`, `errors.js` | Stable DTO vocabulary, limits, explicit failures |
| `lib/operations/config/fields.js`, `definition.js`, `dependencies.js` | Scalar/reference validation, versioned definition validation, capability dependencies |
| `lib/operations/modules/registry.js`, `packs.js` | Trusted module registry and copied reference configurations |
| `lib/operations/server/staff_identity.js`, `access.js` | Verified Supabase principal, project and action-level access |
| `lib/operations/server/store.js`, `commands.js` | Server-only DB routines and command dispatch |
| `lib/operations/workspaces/service.js` | Configuration draft/publish/archive rules |
| `lib/operations/records/service.js`, `references.js`, `projection.js` | Common records, typed links and response projections |
| `lib/operations/client.js` | Authenticated API transport; no direct table access |
| `app/api/operations/events/[eventId]/workspace/route.js` | Read/setup/configuration endpoints |
| `app/api/operations/events/[eventId]/modules/[moduleKey]/records/route.js` | Paginated read and create |
| `app/api/operations/events/[eventId]/modules/[moduleKey]/records/[recordId]/route.js` | Update/archive/transition |
| `components/internal/screens/operations/workspace_section.jsx`, `setup_panel.jsx`, `module_editor.jsx`, `records_view.jsx`, `record_dialog.jsx`, `use_workspace.js` | Existing event editor integration and reusable record screens |
| `components/internal/screens/events/event_sections.js` | Optional Operations entry using existing section navigation |
| `geiger-rbac.config.js` | Explicit event-scoped operational permission keys |
| ORM-generated `operations_foundation.sql` migration | Workspace/version/entity/custom-record/link/audit/idempotency tables and private routines |
| Matching `*.test.js`, `scripts/verify-operations-db.mjs` | Contract, service, route and isolated SQL tests |

## Task 1: Common contracts and strict record validation

**Files:** Create `lib/operations/contracts.js`, `errors.js`, `config/fields.js`, `config/definition.js`, `config/fields.test.js`, `config/definition.test.js`.

**Interfaces:**

```js
// All references carry an entity ID; labels are never identity.
// Field: { id, label, type, required, options?, min?, max?, targetModuleKeys? }
// types: text, textarea, email, number, boolean, select, date, reference
// Definition: { key, version, label, capabilities, fields, states, transitions, views }
// Scalar values: string | number | boolean | null; references are separate links.
validateDefinition(input, registry); // validated, immutable Definition or OperationsError
validateRecordValues(definition, values); // whitelisted scalar object or OperationsError
validateReferenceTargets(definition, references, targets, { projectId, eventId }); // validated link intents
// reference intent: { fieldId, targetId }; target includes projectId/eventId/moduleKey
// OperationsError: { code, status, message, fields? }
```

- [ ] Write the failing tests with concrete definitions:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { validateRecordValues } from "./fields.js";
const definition = {
  key: "vendor-inspection", version: 1,
  fields: [{ id: "name", type: "text", required: true },
    { id: "approved", type: "boolean" }, { id: "count", type: "number", min: 0 }],
};
test("inspection keeps false and zero without permitting structured scalars", () => {
  assert.deepEqual(validateRecordValues(definition, { name: "Vendor", approved: false, count: 0 }),
    { name: "Vendor", approved: false, count: 0 });
  assert.throws(() => validateRecordValues(definition, { name: { value: "Vendor" } }),
    (error) => error.code === "invalid_values");
  assert.throws(() => validateRecordValues(definition, JSON.parse('{"name":"Vendor","__proto__":{}}')),
    (error) => error.code === "unknown_field");
});
```

- [ ] Run `node --test lib/operations/config/*.test.js` and confirm failure because modules do not exist.
- [ ] Implement whitelisted validation using a `Map` of stable field IDs; never merge input onto definitions. Limits: 40 fields/module, 100 options/select, 200 characters/title, 10,000 characters/textarea, 1,000 records/page maximum with a normal limit of 50. Require finite numbers, actual booleans, ISO dates, defined select options and known field keys. Return `{}` for an empty valid optional form. Reject duplicate/reserved field IDs (`__proto__`, `prototype`, `constructor`). Email validation reuses the same simple syntax as shared forms but runs on the server.

```js
export const OPERATIONS_LIMITS = Object.freeze({ fields: 40, options: 100, page: 50, maxPage: 1000 });
export class OperationsError extends Error {
  constructor(code, status, message, fields) {
    super(message); this.name = "OperationsError";
    this.code = code; this.status = status; this.fields = fields;
  }
}
// Unknown values fail before walking fields; conditional required validation
// applies only to supported field rules, and unknown rules are rejected.
```

- [ ] Add independent workshop and competition definitions to the tests. Verify both use the same validator, field renaming preserves IDs, and invalid date/select/number inputs return field errors.
- [ ] Run the focused tests and commit `feat: define event operations contracts and validation`.

## Task 2: Registry, capability dependencies and reference packs

**Files:** Create `modules/registry.js`, `modules/packs.js`, `config/dependencies.js` and their tests.

**Consumes:** Task 1 `validateDefinition` and `OperationsError`.

**Produces:** `getModuleDefinition(key, version)`, `listImplementedCapabilities()`, `validateModuleSet(definitions)`, `instantiatePack(packKey)` returning `{ packKey, packVersion, modules: Definition[] }`. Native adapters and custom modules are explicit registry entries; a custom key cannot shadow a trusted native key.

- [ ] Write and run failing pack/dependency tests:

```js
test("pack instances are independent and unknown capabilities fail closed", () => {
  const first = instantiatePack("workshop");
  const second = instantiatePack("workshop");
  first.modules[0].label = "Edited";
  assert.notEqual(first.modules[0].label, second.modules[0].label);
  assert.throws(() => validateModuleSet([{ ...second.modules[0], capabilities: ["run-javascript"] }]),
    (error) => error.code === "unknown_capability");
});
```

- [ ] Register A1's implemented record/edit-form/board/audit capabilities. Resolve dependencies by capability/provider IDs; detect cycles and missing or disabled providers. Never inspect an event type or template label in validation.

```js
const field = (id, label, type, extra = {}) => ({ id, label, type, ...extra });
const recordModule = (key, label, fields) => ({
  key, version: 1, label, capabilities: ["records", "forms"], fields,
  states: [{ key: "new", label: "New" }, { key: "in-progress", label: "In progress" },
    { key: "complete", label: "Complete" }],
  transitions: [{ from: "new", to: "in-progress" }, { from: "in-progress", to: "complete" },
    { from: "complete", to: "in-progress" }], views: ["table", "board"],
});
const definitions = {
  "accepted-items": recordModule("accepted-items", "Accepted items", [
    field("title", "Title", "text", { required: true }),
    field("category", "Category", "select", { options: ["Talk", "Poster"] }),
  ]),
  "speaker-preparation": recordModule("speaker-preparation", "Speaker preparation", [
    field("name", "Name", "text", { required: true }), field("email", "Email", "email"),
    field("confirmed", "Confirmed", "boolean"),
  ]),
  "course-preparation": recordModule("course-preparation", "Course preparation", [
    field("title", "Title", "text", { required: true }), field("trainer", "Trainer", "text"),
    field("attendee-target", "Attendee target", "number", { min: 0 }),
  ]),
  "equipment-checks": recordModule("equipment-checks", "Equipment checks", [
    field("item", "Item", "text", { required: true }),
    field("quantity", "Quantity", "number", { min: 0 }), field("checked", "Checked", "boolean"),
  ]),
  entries: recordModule("entries", "Entries", [
    field("title", "Title", "text", { required: true }),
    field("category", "Category", "select", { options: ["Individual", "Team"] }),
  ]),
  "judge-onboarding": recordModule("judge-onboarding", "Judge onboarding", [
    field("name", "Name", "text", { required: true }), field("email", "Email", "email"),
    field("confirmed", "Confirmed", "boolean"),
  ]),
};
const packs = {
  conference: { key: "conference", version: 1, modules: ["accepted-items", "speaker-preparation"] },
  workshop: { key: "workshop", version: 1, modules: ["course-preparation", "equipment-checks"] },
  competition: { key: "competition", version: 1, modules: ["entries", "judge-onboarding"] },
};
export function instantiatePack(packKey) {
  const pack = packs[packKey];
  if (!pack) throw new OperationsError("unknown_pack", 422, "Choose an available pack.");
  return { packKey, packVersion: pack.version,
    modules: pack.modules.map((key) => structuredClone(definitions[key])) };
}
```

- [ ] Definition states are stable keys: `new`, `in-progress`, `complete`; board labels are configurable. Transitions explicitly allow `new→in-progress`, `in-progress→complete`, `complete→in-progress`. Keep these pack defaults editable; native module invariants cannot be weakened.
- [ ] Test disabling a provider while its dependent is active, duplicate keys, unsupported view types and pack-copy isolation. Run tests and commit `feat: add versioned operations module registry and packs`.

## Task 3: Private storage, referential integrity and atomic commands

**Files:** Create the ORM migration with `npm run db:new -- operations_foundation`; create `scripts/verify-operations-db.mjs` based on the isolated sponsorship fixture. Do not apply to shared Supabase during this task.

**Produces:** private storage for the following exact contracts:

| Table | Keys and constraints |
| --- | --- |
| `ops_workspaces` | `project_id`, `event_id` unique, `revision bigint >= 1`, `status draft/active/archived`, `published_version` |
| `ops_workspace_versions` | `(project_id,event_id,version)` unique; immutable published configuration JSONB; created actor |
| `ops_module_instances` | `(project_id,event_id,module_key)` unique; enabled flag; current definition version |
| `ops_custom_module_versions` | `(project_id,event_id,module_key,version)` unique; immutable definition JSONB |
| `ops_entities` | UUID ID, project/event/module/definition version/title/state/revision; unique composite identity |
| `ops_custom_records` | composite entity FK; scalar `values` JSONB; no references hidden in JSON |
| `ops_entity_links` | source and target composite event-scoped FKs; field ID; unique source/field/target |
| `ops_audit` | immutable event-scoped command/action/entity/actor/change metadata with server timestamp |
| `ops_command_receipts` | unique `(project_id,event_id,actor_id,command_id)`; request hash and original response |

- [ ] Write isolated SQL tests first: anonymous and authenticated direct access denied; cross-event link fails FK; duplicate entity identity fails; stale revision fails; failed audit insert rolls back record mutation; replay uses one audit row; identical command ID with changed request hash fails.
- [ ] Generate the migration, then define typed columns and composite constraints. Every operational row carries non-null project/event IDs. Add a unique parent key on `events.events(id, project_id)` if none exists after inspecting migrations. Use a unique composite key for the authoritative `ops_entities` registry:

```sql
unique (project_id, event_id, id, module_key, definition_version),
foreign key (project_id, event_id, module_key, definition_version)
  references events.ops_custom_module_versions(project_id, event_id, module_key, version)
```

Native definitions are persisted into the same pinned-definition catalogue when instantiated; `ops_custom_module_versions` stores the event's native/custom definition snapshot with an explicit `source_kind` discriminator, avoiding an unchecked native foreign-key exception.

- [ ] Add event-leading indexes for entities/module/state and audit/time. Revoke all table/routine privileges from `public`, `anon`, `authenticated`; enable RLS with no client policies. Grant the existing server role only required operations. Do not create a public storage bucket or public record projection in A1.
- [ ] Create private routines `ops_publish_workspace` and `ops_mutate_record`. Only `service_role` can execute them. Both receive a server-verified actor and pinned configuration version, take the event row lock, check expected revision, write mutation/audit/receipt in one transaction, and return a whitelisted DTO.

```sql
-- Publish: lock event; compare workspace revision; append immutable version;
-- persist module definitions/instances; increment workspace revision; audit.
-- Record: lock event; verify module enabled/current published version;
-- find receipt; reject hash mismatch or return previous result;
-- compare entity revision; validate linked entity scope with composite FKs;
-- insert/update entity plus scalar subtype and links; append audit and receipt.
-- Map stale revision to SQLSTATE 40001; bad configuration to 22023.
```

- [ ] Run the isolated SQL tests against the actual migration. Record commands and passing cases. Commit `feat: add private operations persistence and atomic commands`.

## Task 4: Verified staff identity and action access

**Files:** Create `server/staff_identity.js`, `server/access.js`, tests; modify `geiger-rbac.config.js`.

**Interfaces:** `resolveStaffPrincipal(request)` returns `{ kind: "staff", id }` from verified Supabase Auth; `authorizeEventAction(principal,eventId,action)` returns server-loaded event/project access or throws. Client-supplied principal, project membership, email and permission arrays are never trusted.

- [ ] Write failing tests for no credentials (401), invalid credentials (401), valid user in another project (404), same project without action (403), scoped action for another event (403), and revoked grant (403). Fake the identity/storage boundary, not the authorization result.
- [ ] Use `@supabase/ssr` server cookies for browser sessions and verify bearer JWTs through `auth.getUser(token)` for explicitly supported API clients. Keep provider adapters separate; portal sessions are not accepted by staff routes in A1.

```js
// staff_identity.js is server-only. Never authorize with auth.getSession().
const { data, error } = token
  ? await authClient.auth.getUser(token)
  : await authClient.auth.getUser();
if (error || !data.user) throw new OperationsError("unauthenticated", 401, "Sign in to continue.");
return { kind: "staff", id: data.user.id };
```

- [ ] Add event-scoped permission keys: `events.operations.view`, `events.operations.configure`, `events.operations.records.create`, `events.operations.records.update`, `events.operations.records.archive`. Add explicit permissions to appropriate trusted system-role templates, not to every existing project member by default.
- [ ] Load roles/grants fresh server-side with `adminClient()` only after verified identity. Reuse `@geiger/rbac`'s `evaluate` API with the verified actor and event scope. Confirm project membership independently. No process-wide cached grant snapshot; revocation applies on the next command.
- [ ] Require manager scope for A1 custom records; never suggest evaluator/volunteer restricted access is delivered here. Resolve suite role-write prerequisites before enabling this in a pilot. Do not silently trust UI-only role editing.
- [ ] Run focused tests and commit `feat: enforce server-side operations action access`.

## Task 5: Configuration lifecycle and workspace endpoints

**Files:** Create `server/store.js`, `server/commands.js`, `workspaces/service.js`, workspace API route and tests.

**Interfaces:**

```js
readOperationsJson(request); // bounded 256 KB JSON object; 400/413/415 errors
handleOperationsRequest(work); // invokes async work; private/no-store Response.json
readWorkspace(context); // { revision, status, publishedVersion, draft, modules }
saveWorkspaceDraft(context, { expectedRevision, modules });
publishWorkspace(context, { expectedRevision, commandId });
archiveModule(context, { moduleKey, expectedRevision, commandId });
// context contains verified principal/event/project; only access.js creates it.
// API GET reads; PUT saves draft; POST publishes; PATCH archives a module.
```

- [ ] Write failing service/route tests: duplicate module key → 422; unavailable evaluation capability → 422; changed required field type with existing records → 409; stale publish → 409 with current revision; publication retains previous immutable version; archive retains records and prevents normal module access.
- [ ] Implement service composition in this order: resolve event context, authorize action, validate definition/dependencies, compare revision, call one transactional store routine, project response. Routes parse a capped JSON body (256 KB), verify UUID route IDs, await current Next.js route `params`, and map typed errors.

`readOperationsJson` checks content type, reads request-stream chunks while counting bytes, cancels above 262,144 bytes, parses JSON, and requires a non-array object. `handleOperationsRequest` maps `OperationsError` to its status, maps store SQLSTATE 40001 to `revision_conflict`/409 and 22023 to `invalid_input`/422, and returns `Cache-Control: private, no-store`. Unexpected failures return `{ error: { code: "internal_error", message: "Couldn't complete the request.", requestId } }` with status 500; SQL messages are never returned to the client.

```js
export async function POST(request, { params }) {
  const { eventId } = await params;
  return handleOperationsRequest(async () => {
    const principal = await resolveStaffPrincipal(request);
    const context = await authorizeEventAction(principal, eventId, "events.operations.configure");
    const input = await readOperationsJson(request);
    return publishWorkspace(context, input);
  });
}
// handleOperationsRequest returns Response.json; unexpected errors log a
// request ID and return a generic 500 without SQL/private configuration data.
```

- [ ] Publishing a breaking definition edit requires a new definition version and an explicit record migration. A1 rejects destructive migration rather than automatically converting historical values. Non-breaking draft additions publish a new pinned version.
- [ ] Ensure no imports of server store/admin credentials enter client code. Run route/service/SQL tests and commit `feat: publish versioned event workspace configuration`.

## Task 6: One custom-record engine, relations and revisions

**Files:** Create `records/service.js`, `references.js`, `projection.js`, record API routes and tests.

**Interfaces:**

```js
listRecords(context, { moduleKey, cursor, limit, state });
createRecord(context, { moduleKey, title, values, references, commandId });
updateRecord(context, { moduleKey, recordId, expectedRevision, title, values, references, commandId });
transitionRecord(context, { moduleKey, recordId, expectedRevision, nextState, commandId });
archiveRecord(context, { moduleKey, recordId, expectedRevision, commandId });
// DTO: { id, moduleKey, definitionVersion, title, state, revision, values, references }
// Lists: { items: RecordDTO[], nextCursor: string|null }; cursors bind module/event/filter.
```

- [ ] Write service tests for vendor inspection, workshop equipment checks and competition onboarding through these same functions. Test a foreign-event reference, a reference to a disallowed module, unknown scalar field, malicious filter/cursor, stale update, unsupported transition, archive retention and duplicate-command replay.

```js
test("a link cannot escape its event even when the target UUID exists", () => {
  const definition = { fields: [{ id: "owner", type: "reference", targetModuleKeys: ["people"] }] };
  assert.throws(() => validateReferenceTargets(definition,
    [{ fieldId: "owner", targetId: "person" }],
    [{ id: "person", moduleKey: "people", eventId: "other-event", projectId: "project" }],
    { eventId: "this-event", projectId: "project" }),
  (error) => error.code === "invalid_reference");
});
```

- [ ] Implement lookup/validation with published module definitions; resolve references by a batch of actual entity IDs, require same scope and allowed target type. Do not query a table or column supplied by a client.
- [ ] Implement parameterized pagination by `(created_at,id)` and allow only `state` equality in A1. Reject arbitrary filter operators/SQL fragments. Normal views require enabled workspace/module and non-archived entity; manager archive queries explicitly authorize history.
- [ ] Use `ops_mutate_record` for every mutation and generate audit changes from validated values. Store a request hash for idempotency. Repeated command IDs with changed payloads return 409; a new intentional edit uses a new command ID.
- [ ] Run all contract/service/SQL tests and commit `feat: add shared event-scoped custom record operations`.

## Task 7: Native event-editor integration and reusable screens

**Files:** Create the UI/client files listed in the file map; modify event sections. Read current `event_detail.jsx`, `EditorShell`, record managers and Geiger Flow/Notes patterns before UI edits. Use the frontend-design and React review skills when executing this task.

**Interfaces:** `WorkspaceSection({ event, headerItem })`; `useWorkspace(eventId)` returns load/error/data and request actions; `RecordDialog({ definition, record, onSave, onOpenChange })` uses stable field IDs. UI imports only DTO contracts and API transport.

- [ ] First write transport/hook reducer tests for no workspace, loading, failed read, retained draft after 409, successful publication, and stale response after switching events. Abort previous requests on scope change.
- [ ] Add the Operations section beside existing editor groups. For events without a workspace, show **Set up workspace**; offer three reference packs or an empty workspace. Do not enable it for existing events automatically.
- [ ] Build focused setup/module/record panels with `@geiger/ui`. Use the shared field editor/input patterns with Task 1 strict validation, table/board components, existing spacing/tokens, Lucide icons and `LogoLoading` without its name prop. Labels are editable; permission/module/field IDs are stable.

```js
// Keep failed commands as drafts; never announce success on a false response.
const response = await operationsClient.updateRecord(eventId, moduleKey, record.id, draft);
if (response.error?.code === "revision_conflict") {
  setConflict(response.error);
  return; // preserve draft and offer reload/compare
}
if (response.error) { setError(response.error); return; }
setRecord(response.data);
```

- [ ] Module disable shows record count and dependent modules before archival. New fields use new stable IDs. Duplicate labels are allowed; duplicate IDs are not. Unsupported scheduling/evaluation controls remain unavailable rather than invoking empty handlers.
- [ ] Browser-check: setup conference, workshop and competition events; edit each pack; create a vendor-inspection custom module; create/link/edit/transition/archive records; switch event; simulate failed save; verify narrow-user denial; inspect public event payload for absent Operations data. Add automated browser infrastructure only if needed and available; do not add a dependency solely for this plan.
- [ ] Lint touched files, run tests and a production build for this significant UI integration. Commit `feat: integrate configurable event operations workspace`.

## Task 8: Review, pilot gate and rollout

**Files:** Add `docs/operations/foundation.md`; update this plan with completed checkboxes and actual migration filename.

- [ ] Record migration order, feature enablement, action keys, definition limits, revision conflict behavior, archived-history rules and rollback constraints. Document that scheduling, attendance, external invitations and live evaluations await subsequent subprojects.
- [ ] Verify all tests and the isolated SQL harness; run `git diff --check`; retain precise command outcomes. Run browser acceptance against an isolated/pilot database before enabling a real event. Do not label unexecuted integration checks as passing.
- [ ] Request independent code review of the full change, including public/private boundaries, identity, capability validation, cross-event FKs, transactions and stale-update handling. Resolve important findings before merge.
- [ ] Release disabled by default. Validate deployed role-definition write policies and only then enable an opted-in staff-only pilot. Explicit deployment authorization and production migration readiness are evaluated separately from writing code.
- [ ] Commit and push the verified implementation using the user's authorised integration target. Never force-push or overwrite new remote commits.

## Self-review and later plan boundaries

This plan covers the design's optional workspace entry, module contracts, versioned configuration, bounded custom records, stable entity identities, event-scoped staff access, references, revisions, audit and maintainable file boundaries. It intentionally does not claim the conference acceptance workflow is implemented by A1.

The following requirements receive subsequent independent plans: native contact-linked participants/resources/activities; staff/portal identity links and scoped external grants; schedules/reservations/assignments; immutable programme releases/acknowledgements; outbox/email consumer; versioned response forms; attendance corrections; evaluation cycles/results/release; permission-scoped exports; legacy import/cutover. The capability registry and composite entity identity provide their integration points without introducing conference conditions into core services.

Before execution, confirm this first deliverable and execution approach. Native execution is a reasonable choice for this tightly coupled foundation, with an independent review before merge. Subagent-driven execution offers an independent gate at each task.
