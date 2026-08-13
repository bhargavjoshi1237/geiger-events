---
name: deepseek-build
description: Plan a change yourself, then hand the mechanical code-writing to DeepSeek via opencode, review the result, and finish it. Use when the user asks to build/implement something with DeepSeek, says "hand this to deepseek", "use opencode", or invokes /deepseek-build. Do NOT use for debugging, research, or one-line edits.
---

# DeepSeek build handoff

You do the thinking. DeepSeek does the typing. You own the result.

The point is to move **output token volume** off Claude, not to outsource judgment.
Planning badly and delegating is worse than not delegating.

## When NOT to use this

- One-line or single-function edits — the handoff overhead exceeds the saving.
- Debugging, root-causing, or anything needing conversation with the user.
- Work you can't specify precisely enough to review. If you can't write the spec,
  you can't check the output.

## The workflow

### 1. Plan it fully yourself — normally

Nothing about this step changes. Do exactly what you would without the skill:

- Read the relevant files, screens, and reference implementations.
- Follow `CLAUDE.md`, `MODULE_CONVENTIONS.md`, `SUPABASE_CONVENTIONS.md`,
  `MIGRATION_CONVENTIONS.md`, `ADDON_CONVENTIONS.md`, `crafting.md`.
- Invoke other skills as usual (brainstorming, frontend-design, supabase, etc.).
- **Ask the user the module questions** the conventions require — entity fields,
  status set, filters, KPIs, tabs, row actions, persistence shape. `crafting.md`
  is explicit that this is the one time to ask freely. Do it *before* delegating.

Do not hand off until you could write the code yourself.

### 2. Write the handoff spec

Write the spec to the scratchpad (`.../scratchpad/handoff.md`), not inline in the
shell command — specs are long and shell-quoting mangles them.

The spec must be precise enough that a competent stranger produces the right code:

- **Goal** — one paragraph.
- **Files** — exact paths, each marked create / modify, with what goes in each.
- **Contracts** — component props, function signatures, data-layer function names,
  return shapes. Name the exact imports to use (`@geiger/ui`, `@/components/ui/*`,
  the area's `constants.js`).
- **Patterns to mirror** — point at the concrete reference file
  ("mirror `components/internal/screens/events/all_events.jsx`"). This is the
  single highest-leverage line in the spec.
- **Non-negotiables** — semantic color tokens only, no hardcoded hex; shared kit
  before bespoke layout; data from the data layer, never a static seed array;
  snake_case DB ↔ camelCase UI at the boundary; concise single-line comments.
- **Out of scope** — say what not to touch. DeepSeek will otherwise tidy
  neighbouring code.
- **Done when** — `npx eslint <files>` clean and the listed files exist with the
  described exports.

opencode reads `AGENTS.md` and `CLAUDE.md` natively, so don't paste the whole
convention set. Do restate the few rules that actually bind this change.

### 3. Run DeepSeek

Always `ds/deepseek-v4-flash`. **Never `deepseek-v4-pro`** — it is the weaker
model here despite the name.

```bash
cd C:/Pro/geiger-events && \
DEEPSEEK_API_KEY=$(grep '^DEEPSEEK_API_KEY=' .env | cut -d= -f2) \
opencode run --auto --model ds/deepseek-v4-flash \
  "$(cat /path/to/scratchpad/handoff.md)" 2>&1 | tee /path/to/scratchpad/ds-run.log
```

Run it in the background (`run_in_background: true`) for anything non-trivial —
multi-file work takes minutes and you'll be notified on completion.

Guardrails are enforced by opencode itself, from `opencode.json` at the repo root
— **you do not police DeepSeek's commands.** Bash is default-deny with only
`npx eslint*`, `npm run lint*`, and `node *` allowed. Everything else — git,
`npm run db:*`, `npm run dev`, curl, rm — is blocked at the tool layer even under
`--auto`. Web fetch and search are off. This is verified behavior, not a hope.

If the run needs a correction, continue the same session rather than restarting:
`opencode run --auto --session <ses_id> --model ds/deepseek-v4-flash "<fix>"`.
The session id is in the run log (`--format json` emits it as `sessionID`).

### 4. Review — this is your job, not a formality

The working tree is often already dirty, so **`git diff` alone will not isolate
DeepSeek's work.** Get the touched files from the run log instead — opencode
prints `Edit <file>` and `Write <file>` per operation:

```bash
grep -oE "(Edit|Write) [^ ]+" /path/to/scratchpad/ds-run.log | sort -u
```

Then **read every one of those files in full.** Check:

- Correctness against the spec, and that nothing outside scope was touched.
- Conventions: semantic tokens (no hex), shared kit usage, data-layer-first,
  loading / empty / filtered-empty states, `*_MAP` lookups from `constants.js`.
- Imports are real and used; no invented components or dead imports.
- No static seed arrays, no mock row data left in components.

Run `npx eslint <touched files>` yourself and confirm it's clean.

### 5. Fix minor issues yourself

Naming, imports, a wrong token, a missing state, a stray comment — **just fix
them.** Do not re-delegate small corrections; the round trip costs more than the
edit. Re-delegate only if a whole file is structurally wrong.

Do not run a build (per `CLAUDE.md`) and do not do browser testing — that is
outside this skill's scope.

### 6. Report

Tell the user plainly:

- What DeepSeek wrote (the file list).
- What you changed on review, and why.
- Anything you could not verify (browser behavior, runtime data, migrations).
- Whether eslint is clean — with the actual result, not an assumption.

If DeepSeek's output was substantially wrong, say so rather than quietly
rewriting it — that signal decides whether this workflow is worth continuing.

## Failure modes

| Symptom | Cause / fix |
|---|---|
| `provider ds not found` | Run from the repo root — `opencode.json` is resolved from cwd. |
| Auth / 401 | `DEEPSEEK_API_KEY` missing from `.env`, or the `grep`/`cut` extraction returned empty. |
| A command "failed" with a permission rule error | Working as designed. If it's genuinely needed and safe, add it to the allowlist in `opencode.json` and tell the user you did. |
| Run hangs | A long-running command was attempted; `npm run dev` and friends are denied, so suspect a `node *` script that doesn't exit. |
| Empty / trivial output | The spec was too vague. Tighten it and rerun — don't paper over it by writing the code yourself without saying so. |
