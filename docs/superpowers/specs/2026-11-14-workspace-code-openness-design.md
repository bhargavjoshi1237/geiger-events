# Workspace — Code & openness (sub-project 7 of 8)

Date: 14 November 2026 · Status: decided by Claude under the user's standing instruction; open to review
Needs: Process & automation (steps, queue, system actor), Portals (blocks).

## Goal

Let organisers go past the built-in parts without forking the product: run small pieces of code in automations, drop custom components onto pages, read and write workspace records from other systems, and get told when records change.

## Decisions

| Topic | Decision |
|---|---|
| Code steps | Automation step `run_code`: JavaScript run in **QuickJS (WASM)** via `quickjs-emscripten-core` + the single-file release build. Limits: 32 MB memory, 1 s CPU (interrupt handler), 64 KB source, 256 KB output, no network, no timers, no host objects. Input: `record` (values by field key), `event`, `trigger`, `steps` (earlier outputs). Return `{ set: { field_key: value }, status, output }`; `set`/`status` are applied as an `update_record` would, through the same checks. |
| Custom components | Block `custom`: organiser HTML/CSS/JS rendered in `<iframe sandbox="allow-scripts" srcdoc>` (opaque origin: no cookies, no storage, no parent DOM) with a strict CSP (`connect-src 'none'`; scripts inline or from cdnjs / jsDelivr). A small bridge (`window.geiger`) asks the parent for the block's data — the same viewer-scoped rows any table block gets — and can open records, navigate, and resize. |
| API | Extend the existing public API (`/api/v1`, `gev_live_` keys, rate limit) with scopes `read:workspace` and `write:workspace`: list structure, list/get records (filters in the workspace filter format), create/update/delete records. Writes run as the system actor (`actor_kind = 'api'`, actor = key) and pass stage rules. |
| Outgoing webhooks | Workspace event types join the existing webhook catalog (`workspace.record.created`, `.updated`, `.deleted`, `workspace.status.changed`), emitted from the change log trigger through `events.webhook_emit`. Existing endpoints, signing, retries and delivery log apply unchanged. Plus an automation step `webhook` (POST JSON to an https URL; SSRF-guarded like webhook delivery; signed with the workspace's hook secret). |
| Incoming webhooks | Trigger `hook`: each such automation gets a secret URL `/events/api/v1/workspace/hooks/<automationId>/<token>` (under `/api/v1`, which geiger-dash already lets through signed out, so no allowlist change). A POST (JSON or form, ≤ 64 KB) queues the body and answers 202; steps use `{{payload.path}}`, and a list trigger runs on `payload.recordId` when given. Token stored as a sha256 hash; regenerate any time. |

## Data model (migration `20261119100000_workspace_openness.sql`)

- `events.api_keys` scope check accepts `read:workspace`, `write:workspace`.
- The change trigger function also calls `events.webhook_emit` for the workspace types (only when an endpoint wants them).
- `workspace_workspaces.hook_secret` (for signing outgoing step webhooks).

## Server

```
lib/workspace/code/sandbox.js        QuickJS runner (tested: limits, no IO, output shape)
lib/workspace/code/bridge.js         custom-block bridge protocol (shared by iframe host + srcdoc builder)
lib/workspace/api/records.js         v1 handlers over workspace service + system command
app/api/v1/workspace/[eventId]/...   lists, records
app/api/v1/workspace/hooks/[automationId]/[token]/route.js   (built with sub-project 3)
```

## UI

- Automation editor: "Run code" step with a code editor (monospace textarea with line numbers), sample input from a chosen record, and a Test button showing output/errors.
- Page builder: "Custom" block with HTML / CSS / JS tabs.
- Settings → API & webhooks (existing screen) lists the new scopes and event types automatically; the Workspace settings screen links to it and shows example requests for this event's lists.

## Testing

Unit: sandbox limits (infinite loop interrupted, memory cap, no `fetch`), result validation, bridge messages. Lint; build.

## Decisions made while building (15 Nov 2026)

- Sandbox: `quickjs-emscripten-core` + `@jitl/quickjs-singlefile-cjs-release-sync` 0.32.0, a fresh runtime per run (32 MB, 512 KB stack, 1 s deadline through the interrupt handler). The code is the body of an `async` function, so `await` works; `console.log` is captured (50 lines) and shown in the run log. After an out-of-memory error QuickJS can refuse to free cleanly; the WASM module is then dropped and rebuilt on the next run. A runaway memory loop can take ~5 s of wall time before it's stopped.
- Code input: `record` is the record by field key (links as `{ id, label, kind }`, lookups and rollups calculated) plus `id`, `number`, `title`, `status` unless a field uses that key; `trigger` includes `payload` for webhooks and check-ins; `steps` holds earlier steps' outputs, also after a wait. Returning `{ set, status, output }` updates the record through the stage rules; anything else is the step's output.
- "Test" in the code step runs against a chosen record (`code.test`, configure permission) and changes nothing.
- Outgoing `webhook` step: the address is checked like webhook endpoints at save time and through `safe_fetch` at send time (no redirects, 10 s, 64 KB answer). The body is `{ id, type: "workspace.automation", created, event, automation, record, trigger, steps }`, signed with the workspace's `hook_secret` in the same `Geiger-Signature` format as endpoint deliveries. A JSON answer becomes the step's output.
- Custom block: the srcdoc carries a CSP meta tag (`default-src 'none'`, scripts/styles inline or from cdnjs/jsDelivr, `connect-src 'none'`, images from any https host). Every bridge call travels on a per-mount channel id and is checked against the iframe's `contentWindow`. `geiger.data()` returns the same viewer-scoped rows as a table block, keyed by field key, with hidden fields left out. The frame grows to fit its content (80–2000 px).
- Public API: `/api/v1/workspace/<eventId>/lists`, `…/lists/<list key or id>/records` (GET with `filter` JSON using field keys, `sort=-number,title`, `search`, `limit` ≤ 100, `offset`; POST) and `…/records/<id>` (GET, PATCH with optional `expected_revision`, DELETE). `Idempotency-Key` makes writes replay-safe (command id derived from the key and the header). Writes run as the key (`actor_kind = 'api'`, shown as "API · <key name>") and pass stage rules (409 `move_not_allowed`).
- Webhook events come from the change-log trigger: created (full values), updated (`values` and `changed` hold only what changed), `status.changed` (`from`, `to`), and deleted (one per record). Each payload includes the actor. Undos are never sent, and a webhook error never blocks the write.

## Out of scope

npm packages inside code steps, long-running jobs, GraphQL, OAuth apps.
