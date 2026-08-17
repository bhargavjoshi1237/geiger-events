# 16 — Workflows

| | |
|---|---|
| **Nav items** | 3 — All Workflows, Workflow Templates, Run History |
| **Registered** | 3/3 |
| **Tier** | **B — a beautiful editor for a program that never runs** |
| **Blocked by** | [00 H1 jobs](00-cross-cutting.md), [00 H2 send stack](00-cross-cutting.md) |
| **Key files** | `workflows/all_workflows.jsx` (584), `workflow_builder.jsx`, `canvas/workflow_canvas.jsx` + `workflow_nodes.jsx` + `zoom_controls.jsx`, `step_list.jsx`, `constants.js` (571 — `TRIGGER_CATALOG`, `CONDITION_CATALOG`, `ACTION_CATALOG`, `WORKFLOW_TEMPLATES`), `run_history.jsx`, `lib/supabase/workflows.js` + `workflow_runs.js` |

> The code is candid about it (`constants.js:516`): *"No runner exists yet, so the
> Run History screen reads an (empty) `events.workflow_runs` table and shows its
> empty state until executions land."* **Nothing in the repository has ever
> written a workflow run.**

---

## 1. What this means in industry

Automation (Zapier, HubSpot Workflows, Braze Canvas, n8n) is an **execution
engine** with an editor bolted on, and every serious one has the same parts:

- **Triggers** — event-driven (order created, checked in, registration approved),
  scheduled (daily at 9am), and relative-to-a-date ("3 days before event start").
- **A durable executor** — each step runs as a unit of work with at-least-once
  delivery, retries with backoff, and idempotency so a retried step doesn't
  double-send.
- **Waits and delays** that survive process restarts (a "wait 3 days" step
  cannot live in memory).
- **Branching and conditions** evaluated against a live context object.
- **Run history** — every execution, every step, inputs/outputs, errors, with
  replay from a failed step.
- **Guardrails** — concurrency limits, loop detection, per-contact frequency caps
  so a misconfigured workflow can't mail someone 40 times.

## 2. What exists today (verified)

The authoring half is genuinely well-built:
- A dual-view builder — linear step list **and** a drag-drop node canvas (`@xyflow/react`)
- A real catalog: `TRIGGER_CATALOG`, `CONDITION_CATALOG`, `ACTION_CATALOG` with typed
  config fields per node
- Six curated templates (VIP welcome, check-in thanks, waitlist notify, event reminder,
  failed payment, big spender) using action types like `send.email`, `send.sms`,
  `staff.notify`, `tag.add`, and conditions like `if.buyer_attribute`, `if.order_amount`
- `events.workflow_runs` table + a Run History screen reading it

The execution half is entirely absent:
- **No executor, no trigger listeners, no scheduler, no queue**
- `lib/supabase/workflow_runs.js` exposes only `list` and `get` — there is no `create`
- The actions reference `send.email` and `send.sms`, neither of which has a provider
  ([00 H2](00-cross-cutting.md))

## 3. Pending deliverables

### P0 — A minimal executor (the whole point)
- [ ] `events.workflow_runs` gains write functions; add `events.workflow_run_steps` (run_id, step_index, status, input jsonb, output jsonb, error, started_at, finished_at)
- [ ] **Trigger emission from code that already exists:** fulfilment (`lib/stripe/fulfill-checkout.js`), check-in admit (`lib/supabase/checkin.js`), registration approval. Each emits a typed event with a context payload
- [ ] A dispatcher that matches emitted events to enabled workflows and enqueues a run ([00 H1](00-cross-cutting.md))
- [ ] Step executor with **idempotency keys per (run, step)** so retries can't double-send, plus retry/backoff and a terminal failed state
- [ ] Implement the four actions that can work today: `tag.add`, `staff.notify` (in-app), `record.update`, `webhook.post`. Gate `send.email`/`send.sms` behind a clear "requires the send stack" state rather than silently no-oping

### P1
- [ ] Durable **wait/delay** steps (a scheduled job resuming the run — not a timer in memory)
- [ ] Scheduled and relative-to-date triggers ("3 days before event start")
- [ ] Run History detail: per-step timeline with inputs/outputs and a **replay from step N**
- [ ] Frequency caps and loop detection

### P2
- [ ] Test mode — run against a sample contact with no side effects
- [ ] Versioning: editing a live workflow shouldn't retroactively change in-flight runs

### Important: build one engine, not two
[14 Drip Sequences](14-campaigns.md) is the same problem with a different editor.
**Drip sequences should compile to workflows.** Two execution engines is the
mistake to avoid here.

## 4. UX & component placement

### All Workflows
| Issue | Change |
|---|---|
| Rows show configuration, not health | Once runs exist, the columns that matter are **Last run · Success rate · Runs (7d)**, with a red state for recent failures. A workflow list without run health is an inventory, not a control panel |
| Enabled/disabled isn't prominent | Put the toggle **directly in the row** — enabling/disabling is the most frequent action and shouldn't require opening the builder |

### Workflow builder (list + canvas)
| Issue | Change |
|---|---|
| Two views (step list and canvas) with the same authority | Keep both, but make the switch a clear segmented control in the header and **persist the choice per user**. Also state the relationship: the list is the canonical order, the canvas is the shape |
| The node palette placement | Standardise on the three-zone contract used across the app ([04](04-event-design.md), badge designer, template builder): **palette left, canvas centre, node inspector right.** Today's canvas controls should keep zoom bottom-right |
| No validation feedback | Add a persistent **validation strip docked to the bottom**: "⚠ Step 3 sends email — sending isn't connected", "⚠ No trigger selected". A workflow that can't run should say so while it's being built, not after |
| Save/Enable are the same act | Separate them: `Save` (draft) and `Enable` (goes live) as distinct header actions, with Enable running validation first |
| No test affordance | Add "Test run" beside Enable, opening a drawer to pick a sample contact and showing the step-by-step result |

### Run History
| Issue | Change |
|---|---|
| A flat table of runs | Group by workflow with a **sparkline of success/failure over time** per group; failures first. This screen exists to answer "what's broken", so failures must not be sorted chronologically among successes |
| No drill-down | Clicking a run opens a **step timeline drawer** — each step with duration, status, input/output JSON, error, and a Replay button |
| Empty state today reads as broken | Until the executor lands, the empty state should say *"No runs yet — the workflow runner is not enabled"* rather than the generic "nothing here" |

### Workflow Templates
- Templates are chosen visually and by outcome — use a **gallery with an outcome sentence** ("Thank attendees 2h after they check in") and a step-count badge, not a table
- "Use template" should open the builder with the steps pre-filled *and* a highlighted list of what the user must still fill in

## 5. Schema / API work
- [ ] `events.workflow_run_steps`; `workflow_runs` gains `context jsonb`, `error`, `resume_at`
- [ ] `events.workflow_events` (the emitted trigger log) so a run can be traced to its cause
- [ ] Job kinds: `workflow.dispatch`, `workflow.resume`
- [ ] Emit points added to fulfilment, check-in, registration approval, refund
