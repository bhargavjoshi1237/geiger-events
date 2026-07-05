# Ticket Types → Reusable Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Ticket Types from an event-scoped inline editor into a reusable record (`module: "ticket_type"`) that is created once with full settings, then attached to any event from the event editor and sold on the public page.

**Architecture:** Reuse the existing reusable-records pattern (`events.ticketing_records` + shared `RecordsScreen` + per-module `EditForm` + `metadata.attached[module]` on events). Add `module: "ticket_type"` with a rich edit form (refund + settings). Repoint the event editor's "Ticket Types" tab to an attach panel and retire the embedded tier editor. Optionally wire the public page/checkout to sell attached tickets with a legacy fallback.

**Tech Stack:** Next.js 16 (App Router), React 19 (client components), Tailwind + shadcn/ui, Lucide icons, Supabase (`ticketing_records` in the `events` schema), Sonner toasts.

## Global Constraints

- **No test framework in this repo.** Verification per task is `npx eslint <changed files>` clean (unused imports/vars are errors and must be fixed). Run `npm run build` (`next build`) only once, at the end of the public-sale phase, since that is a significant UI change. Do not scaffold jest/vitest. (AGENTS.md, crafting.md)
- **Semantic color tokens only** — `bg-surface-subtle|card|hover|active`, `text-foreground|muted-foreground|text-secondary|text-tertiary`, `border-border|border-border-strong`, `bg-primary`/`text-primary-foreground`. Never hardcode hex (the one existing exception `#161616` for the selected-chip contrast is already in the codebase and may be reused).
- **Data layer is pure** — `lib/supabase/*.js` validate, `console.error("[ticketing.<x>]", …)` on failure, return `null`/`false`/`[]`, never throw, never toast. DB is snake_case, UI camelCase, mapped at the boundary.
- **All imports use the `@/` root alias.** Files snake_case, React components PascalCase.
- **Commit after each task** with a `feat:`/`refactor:`/`chore:` message ending with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Do not touch** the generic "Ticketing" attach tab (`ticketlinks` → `TicketAttachmentsSection` in `event_attachments.jsx`) or the SQL schema — `ticketing_records.config` jsonb already holds the ticket fields.

---

### Task 1: Ticket config defaults + `listRecordsByIds` data helper

**Files:**
- Modify: `components/internal/screens/tickets/constants.js`
- Modify: `lib/supabase/ticketing.js`

**Interfaces:**
- Produces: `defaultTicketConfig()` → fresh config object (Task 2, 3 consume it); `VISIBILITY_OPTIONS` (already exported, reused by Task 2).
- Produces: `listRecordsByIds(ids: string[])` → `Promise<Record[] | null>` (Task 5 consumes it).

- [ ] **Step 1: Add ticket config defaults to `constants.js`**

Replace the `--- Ticket Types inner rules (metadata.ticketRules) ---` block (the `DEFAULT_TICKET_RULES` export) and keep `VISIBILITY_OPTIONS`. The file's `currency` and `formatDate` formatters stay untouched. New content for that section:

```js
// --- Ticket Types record config (ticketing_records.config, module ticket_type)

// A fresh default config for a new reusable ticket. Returned by a function (not
// a shared literal) so nested objects aren't shared across records.
export const defaultTicketConfig = () => ({
  price: 0, // face value; 0 = free
  qty: 0, // capacity; 0 = unlimited
  description: "", // buyer-facing blurb
  minPerOrder: 1,
  maxPerOrder: 0, // 0 = no max
  refund: { refundable: false, cutoffDays: 7, feeHandling: "absorb" },
  sales: { mode: "always", startAt: "", endAt: "" }, // always | window
  visibility: "public", // public | hidden | scheduled
  onSaleAt: "", // scheduled on-sale datetime (visibility === "scheduled")
  accessCode: { enabled: false, code: "" },
  reservedSeating: false,
});

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "hidden", label: "Hidden" },
  { value: "scheduled", label: "Scheduled" },
];
```

Note: `DEFAULT_TICKET_RULES` was only consumed by `inventory_sections.jsx`, which Task 4 deletes — safe to remove now.

- [ ] **Step 2: Add `listRecordsByIds` to `ticketing.js`**

Insert after `listRecordsByModules` (around line 104), before `getRecord`:

```js
// Records fetched by an explicit id list, for resolving an event's attached
// records on the public page. Order is not guaranteed — the caller re-orders to
// match its id array. RLS governs visibility.
export async function listRecordsByIds(ids) {
  if (!Array.isArray(ids) || !ids.length || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .in("id", ids)
      .is("deleted_at", null);
    if (error) {
      console.error("[ticketing.listByIds]", error.message);
      return null;
    }
    return (data || []).map(normalizeRecord);
  } catch (e) {
    console.error("[ticketing.listByIds]", e);
    return null;
  }
}
```

- [ ] **Step 3: Lint**

Run: `npx eslint components/internal/screens/tickets/constants.js lib/supabase/ticketing.js`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/internal/screens/tickets/constants.js lib/supabase/ticketing.js
git commit -m "feat: add ticket_type config defaults and listRecordsByIds"
```

---

### Task 2: Ticket Types screen → RecordsScreen + rich edit form

**Files:**
- Rewrite: `components/internal/screens/tickets/ticket_types.jsx`

**Interfaces:**
- Consumes: `RecordsScreen`, `defaultTicketConfig`, `VISIBILITY_OPTIONS`, `currency`, `Segmented`, `NumField`.
- Produces: `TicketTypesScreen` (named + default export — registry.jsx already imports the named export from this path; keep the name).

- [ ] **Step 1: Replace the entire file contents**

```jsx
"use client";

import React from "react";
import { Armchair, KeyRound, RotateCcw, Ticket } from "lucide-react";

import { Field, SectionCard, SettingsList, SettingRow } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { RecordsScreen } from "./records_kit";
import { Segmented, NumField as Num } from "./controls";
import { currency, defaultTicketConfig, VISIBILITY_OPTIONS } from "./constants";

const KINDS = [{ value: "ticket", label: "Ticket", defaultConfig: defaultTicketConfig }];

// List-card summary line: "$25 · 200 cap · refundable".
function summarize(r) {
  const c = r.config || {};
  const price = Number(c.price) || 0;
  const qty = Number(c.qty) || 0;
  return [
    price === 0 ? "Free" : currency(price),
    qty > 0 ? `${qty.toLocaleString()} cap` : "unlimited",
    c.refund?.refundable ? "refundable" : "non-refundable",
  ].join(" · ");
}

function TicketEditForm({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const refund = config.refund || {};
  const sales = config.sales || {};
  const access = config.accessCode || {};
  const setRefund = (patch) => set({ refund: { ...refund, ...patch } });
  const setSales = (patch) => set({ sales: { ...sales, ...patch } });
  const setAccess = (patch) => set({ accessCode: { ...access, ...patch } });

  return (
    <div className="space-y-6">
      <SectionCard title="Pricing & inventory" description="What buyers pay and how many are available.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-text-secondary">$</span>
              <Input
                type="number"
                min={0}
                inputMode="decimal"
                value={config.price ?? 0}
                onChange={(e) => set({ price: Number(e.target.value) || 0 })}
                className="tabular-nums"
                placeholder="0"
              />
            </div>
          </Field>
          <Num label="Quantity" hint="0 = unlimited." value={config.qty ?? 0} onChange={(v) => set({ qty: v })} unit="tickets" />
          <Num label="Min per order" value={config.minPerOrder ?? 1} onChange={(v) => set({ minPerOrder: v })} unit="tickets" />
          <Num label="Max per order" hint="0 = no limit." value={config.maxPerOrder ?? 0} onChange={(v) => set({ maxPerOrder: v })} unit="tickets" />
        </div>
        <div className="mt-4">
          <Field label="Description" hint="Shown to buyers under the ticket name.">
            <Textarea
              rows={2}
              value={config.description || ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="e.g. Includes front-row seating and after-party access."
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Refund policy" description="Whether and when buyers can get their money back.">
        <SettingsList>
          <SettingRow
            icon={RotateCcw}
            title="Refundable"
            description="Allow buyers to request a refund before the cutoff."
            checked={!!refund.refundable}
            onCheckedChange={(v) => setRefund({ refundable: v })}
          />
        </SettingsList>
        {refund.refundable ? (
          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Num label="Refund cutoff" hint="Days before the event refunds close." value={refund.cutoffDays ?? 7} onChange={(v) => setRefund({ cutoffDays: v })} unit="days" />
            <Field label="Processing fees" hint="Who absorbs the payment fees on a refund.">
              <Select value={refund.feeHandling || "absorb"} onValueChange={(v) => setRefund({ feeHandling: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="absorb">Refund in full</SelectItem>
                  <SelectItem value="deduct">Keep processing fees</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Sales window" description="When this ticket is on sale.">
        <Field label="Availability">
          <Segmented
            value={sales.mode || "always"}
            onChange={(v) => setSales({ mode: v })}
            options={[
              { value: "always", label: "Always on sale" },
              { value: "window", label: "Scheduled window" },
            ]}
          />
        </Field>
        {sales.mode === "window" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="On sale from">
              <Input type="datetime-local" value={sales.startAt || ""} onChange={(e) => setSales({ startAt: e.target.value })} />
            </Field>
            <Field label="On sale until">
              <Input type="datetime-local" value={sales.endAt || ""} onChange={(e) => setSales({ endAt: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Visibility & access" description="Who can see and unlock this ticket, and seating.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visibility">
            <Select value={config.visibility || "public"} onValueChange={(v) => set({ visibility: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {config.visibility === "scheduled" ? (
            <Field label="On sale from">
              <Input type="datetime-local" value={config.onSaleAt || ""} onChange={(e) => set({ onSaleAt: e.target.value })} />
            </Field>
          ) : null}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <SettingsList>
            <SettingRow
              icon={KeyRound}
              title="Access-code gating"
              description="Hide this ticket until a buyer enters an unlock code."
              checked={!!access.enabled}
              onCheckedChange={(v) => setAccess({ enabled: v })}
            />
            <SettingRow
              icon={Armchair}
              title="Reserved seating"
              description="Buyers pick a seat from a map instead of general admission."
              checked={!!config.reservedSeating}
              onCheckedChange={(v) => set({ reservedSeating: v })}
            />
          </SettingsList>
        </div>
        {access.enabled ? (
          <div className="mt-4 border-t border-border pt-4">
            <Field label="Unlock code" hint="Share this with invited buyers only.">
              <Input value={access.code || ""} onChange={(e) => setAccess({ code: e.target.value })} placeholder="e.g. INSIDER25" className="max-w-xs uppercase" />
            </Field>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

export function TicketTypesScreen() {
  return (
    <RecordsScreen
      module="ticket_type"
      title="Ticket Types"
      description="Reusable tickets. Create one here with its price, refund policy, and settings, then attach it to any event from its edit page."
      singular="ticket"
      icon={Ticket}
      kinds={KINDS}
      summarize={summarize}
      EditForm={TicketEditForm}
    />
  );
}

export default TicketTypesScreen;
```

- [ ] **Step 2: Lint**

Run: `npx eslint components/internal/screens/tickets/ticket_types.jsx`
Expected: no errors. (In particular, the old imports `MainScreenWrapper`, `listEvents`, `EVENT_TYPE_MAP`, `useWorkspaceUrl`, `TicketTypesSection` are gone.)

- [ ] **Step 3: Commit**

```bash
git add components/internal/screens/tickets/ticket_types.jsx
git commit -m "feat: rebuild Ticket Types as a reusable-records screen with refund + settings"
```

---

### Task 3: Event-editor ticket attach panel (+ move Dietary inquiry card)

**Files:**
- Create: `components/internal/screens/tickets/ticket_type_attachments.jsx`

**Interfaces:**
- Consumes: `listRecords` (existing), `useEventConfig`, `useProject`, `useWorkspaceUrl().setTab`, `getDietaryConfig`, `currency`.
- Produces: `TicketTypeAttachmentsSection({ event, headerItem })` (Task 4 wires it into `event_sections.js`).

- [ ] **Step 1: Create the file**

The `AttachInquiryCard` below is moved verbatim from `event_builder.jsx` (lines ~319-404) so the Dietary & Accessibility opt-in survives the editor retirement in Task 4.

```jsx
"use client";

import React, { useEffect, useState } from "react";
import { CircleDot, ListChecks, Loader2, Plus, Ticket } from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listRecords } from "@/lib/supabase/ticketing";
import { getDietaryConfig } from "@/lib/supabase/dietary";
import { currency } from "./constants";

// Opt this event's ticket form into the project's Dietary & Accessibility
// inquiry. Stores just a boolean; the questions live on the project config.
function AttachInquiryCard({ event }) {
  const { projectId } = useProject();
  const [cfg, , saveCfg] = useEventConfig(event, "dietaryInquiry", { attach: false });
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    let alive = true;
    getDietaryConfig(projectId).then((c) => {
      if (alive) setQuestions(c?.questions ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <SectionCard
      title="Dietary & Accessibility inquiry"
      description="Include the workspace inquiry questions in this event's ticket form. Build the question set in Registrations → Dietary & Accessibility."
    >
      <SettingsList>
        <SettingRow
          title="Attach Dietary & Accessibility inquiry"
          description="Ask these questions when someone fills in the ticket form."
          checked={!!cfg.attach}
          onCheckedChange={(v) =>
            saveCfg(
              { attach: v },
              { successMsg: v ? "Inquiry attached." : "Inquiry detached." },
            )
          }
        />
      </SettingsList>

      {cfg.attach ? (
        <div className="mt-4">
          {questions.length ? (
            <div className="space-y-2">
              {questions.map((q) => {
                const TypeIcon = q.type === "multiselect" ? ListChecks : CircleDot;
                return (
                  <div
                    key={q.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5"
                  >
                    <TypeIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{q.label}</span>
                        <Badge variant="neutral">
                          {q.type === "multiselect" ? "Multiple" : "Single"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No inquiry questions yet. Add them in Registrations → Dietary & Accessibility.
            </p>
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}

// Event-editor section: attach reusable ticket_type records to this event.
// Attachment ids live under metadata.attached.ticket_type, so one ticket applies
// to many events without duplication.
export function TicketTypeAttachmentsSection({ event, headerItem }) {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const [attached, , save] = useEventConfig(event, "attached", {});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listRecords(projectId, "ticket_type").then((rows) => {
      if (!alive) return;
      setRecords(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const selected = Array.isArray(attached.ticket_type) ? attached.ticket_type : [];

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    save({ ...attached, ticket_type: next });
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Ticket Types"}
        description={
          headerItem?.desc ||
          "Attach reusable tickets to this event. Manage the tickets themselves under Tickets → Ticket Types."
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-12 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tickets…
        </div>
      ) : records.length ? (
        <div className="grid gap-3">
          {records.map((r) => {
            const on = selected.includes(r.id);
            const price = Number(r.config?.price) || 0;
            const qty = Number(r.config?.qty) || 0;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                  on
                    ? "border-border-strong bg-surface-hover"
                    : "border-border bg-surface-subtle hover:border-border-strong hover:bg-surface-hover",
                  !r.active ? "opacity-60" : "",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    on
                      ? "border-white bg-white text-[#161616]"
                      : "border-border bg-surface-card text-muted-foreground",
                  )}
                >
                  <Ticket className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{r.name}</span>
                    {!r.active ? <Badge variant="neutral">Inactive</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {price === 0 ? "Free" : currency(price)} ·{" "}
                    {qty > 0 ? `${qty.toLocaleString()} cap` : "Unlimited"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                    on
                      ? "border-border-strong bg-surface-active text-foreground"
                      : "border-border text-text-tertiary",
                  )}
                >
                  {on ? "Attached" : "Attach"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <SectionCard
          title="No tickets yet"
          description="Create a reusable ticket under Tickets → Ticket Types, then attach it here."
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTab("Ticket Types")}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Create a ticket
          </Button>
        </SectionCard>
      )}

      <AttachInquiryCard event={event} />
    </div>
  );
}

export default TicketTypeAttachmentsSection;
```

- [ ] **Step 2: Lint**

Run: `npx eslint components/internal/screens/tickets/ticket_type_attachments.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/internal/screens/tickets/ticket_type_attachments.jsx
git commit -m "feat: add reusable ticket attach panel for the event editor"
```

---

### Task 4: Rewire the event editor tab + retire the embedded tier editor

**Files:**
- Modify: `components/internal/screens/events/event_sections.js` (imports + `SECTION_COMPONENTS` + the `tickets` item `desc`)
- Modify: `components/internal/screens/events/event_builder.jsx` (delete embedded editor + moved card + unused imports)
- Delete: `components/internal/screens/tickets/inventory_sections.jsx`
- Modify (comments only): `components/internal/screens/registry.jsx:64`, `components/internal/sidebar/sidebar_nav.jsx:176`

**Interfaces:**
- Consumes: `TicketTypeAttachmentsSection` (Task 3).

- [ ] **Step 1: Repoint the section in `event_sections.js`**

Change the import (line ~40) — remove `TicketsSection` from the `event_builder` import group. It is imported alongside other section exports; delete just that one name from the list.

Change the `tickets` section item (lines ~178-185): update `desc` and drop `ownHeader` (the attach panel renders its own `EditorSectionHeader`):

```js
{
  key: "tickets",
  label: "Ticket Types",
  icon: Ticket,
  desc: "Attach reusable tickets to this event.",
  ownHeader: true,
},
```

Add the import near the other tickets-area import (`TicketAttachmentsSection` at line ~71):

```js
import { TicketTypeAttachmentsSection } from "../tickets/ticket_type_attachments";
```

Change the `SECTION_COMPONENTS` mapping (line ~330):

```js
tickets: TicketTypeAttachmentsSection,
```

- [ ] **Step 2: Delete dead code from `event_builder.jsx`**

Delete these top-level declarations entirely (they are only used by the retired editor):
- `CreateTicketDialog` (lines ~46-132)
- `INITIAL_TICKETS` (lines ~188-193)
- `Perforation` (lines ~197-205)
- `TicketLeft` (lines ~209-220)
- `TicketCard` (lines ~225-314)
- `AttachInquiryCard` (lines ~319-404) — now lives in `ticket_type_attachments.jsx`
- `TicketsSection` (lines ~407-503)

Leave `BasicsSection`, `RegistrationSettingsSection`, and every other export intact.

- [ ] **Step 3: Remove now-unused imports from `event_builder.jsx`**

Definitely remove (only the deleted code used them):
- From `lucide-react`: `CircleDot`, `ListChecks`, `Loader2`, `Plus`, `Ticket`, `Trash2`
- The entire `Dialog` import group: `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
- `import { getDietaryConfig } from "@/lib/supabase/dietary";`

Keep: `Textarea`, `Input`, `Field`, `EditorSectionHeader`, `Select*`, `SettingsList`, `SettingRow`, `useEventConfig`, `React`/`useState`/`useEffect`, `toast`.

- [ ] **Step 4: Lint-driven cleanup for the ambiguous imports**

Run: `npx eslint components/internal/screens/events/event_builder.jsx`
ESLint flags any remaining unused import as an error. Remove exactly what it reports. Likely candidates whose last user was the deleted code: `SectionCard`, `Badge`, `useProject`. If eslint does **not** flag one (another retained section still uses it), leave it. Re-run until clean.

- [ ] **Step 5: Delete `inventory_sections.jsx` and update stale comments**

```bash
git rm components/internal/screens/tickets/inventory_sections.jsx
```

Update the stale comment in `registry.jsx:64` from `// Tickets area. Ticket Types stays per-event (event picker → tiers editor).` to `// Tickets area. Ticket Types is a reusable-records screen (like Discounts).`

Update the stale comment block in `sidebar_nav.jsx:176` — replace the "Ticket Types stays per-event (pick an event → edit its tiers)." sentence with "Ticket Types is a reusable-records screen (create a ticket, attach to events)."

- [ ] **Step 6: Lint the full change set**

Run: `npx eslint components/internal/screens/events/event_sections.js components/internal/screens/events/event_builder.jsx components/internal/screens/registry.jsx components/internal/sidebar/sidebar_nav.jsx`
Expected: no errors. Confirm no file still imports `inventory_sections` or `TicketsSection`:
Run: `git grep -nE "inventory_sections|TicketsSection" -- '*.js' '*.jsx'`
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: repoint Ticket Types event tab to attach panel, retire embedded editor"
```

---

### Task 5 (GATED): Sell attached tickets on the public page

> **Do not start until the reviewer confirms decision #4 (public sale) AND Risk #1 is resolved:** verify `ticketing_records` is readable on the unauthenticated `/e/<id>` page. Test by opening a published event's `/e/<uuid>` while signed out (or in a private window) after attaching a ticket; if `listRecordsByIds` returns empty for anonymous users, a public-read RLS policy on `ticketing_records` (mirroring how published events are read) must be added first in `supabase/sqls/`. That RLS work, if needed, is its own task.

**Files:**
- Modify: `components/internal/screens/events/event_public_page.jsx` (`buildTickets`, `EventPublicPageContent`)

**Interfaces:**
- Consumes: `listRecordsByIds` (Task 1).

- [ ] **Step 1: Add the import** near the other data-layer imports at the top of `event_public_page.jsx`:

```js
import { listRecordsByIds } from "@/lib/supabase/ticketing";
```

- [ ] **Step 2: Add an on-sale helper and extend `buildTickets`** — replace the existing `buildTickets(event)` (lines ~108-129) with a version that prefers attached records:

```js
// True when a ticket_type record is currently buyable given its visibility and
// sales window. Uses a passed `now` (ms) so the render is deterministic.
function ticketOnSale(cfg, now) {
  if (!cfg) return false;
  if (cfg.visibility === "hidden") return false;
  if (cfg.visibility === "scheduled" && cfg.onSaleAt) {
    if (now < new Date(cfg.onSaleAt).getTime()) return false;
  }
  const sales = cfg.sales || {};
  if (sales.mode === "window") {
    if (sales.startAt && now < new Date(sales.startAt).getTime()) return false;
    if (sales.endAt && now > new Date(sales.endAt).getTime()) return false;
  }
  return true;
}

function buildTickets(event, ticketRecords) {
  // Prefer reusable ticket_type records attached to this event.
  const recs = Array.isArray(ticketRecords) ? ticketRecords : [];
  if (recs.length) {
    const now = Date.now();
    const on = recs
      .filter((r) => r.active && ticketOnSale(r.config || {}, now))
      .map((r) => ({
        id: r.id,
        name: r.name || "Ticket",
        price: Number(r.config?.price) || 0,
        qty: Number(r.config?.qty) || 0,
        note: r.config?.description || "",
      }));
    if (on.length) return on;
  }

  // Legacy embedded tiers (backward compatibility).
  if (Array.isArray(event.tickets) && event.tickets.length) {
    return event.tickets.map((t) => ({
      id: t.id ?? null,
      name: t.name || "Ticket",
      price: Number(t.price) || 0,
      qty: Number(t.qty) || 0,
    }));
  }
  if (event.type === "Online" && event.revenue === 0) {
    return [{ name: "Free registration", price: 0, note: "Online access link sent on registration" }];
  }
  const base = eventBase(event);
  return [
    { name: "Early Bird", price: Math.max(0, Math.round(base * 0.7)), note: "Limited availability" },
    { name: "General Admission", price: base, note: "Standard entry" },
    { name: "VIP", price: Math.round(base * 2.2), note: "Front row + after-party" },
  ];
}
```

- [ ] **Step 3: Fetch and order attached records in `EventPublicPageContent`** — it currently does `const tickets = buildTickets(event);` at line ~1387. Replace that single line with a fetch effect + ordered pass-through:

```js
  const attachedTicketIds = Array.isArray(event.attached?.ticket_type)
    ? event.attached.ticket_type
    : [];
  const attachedKey = attachedTicketIds.join(",");
  const [ticketRecords, setTicketRecords] = useState([]);
  useEffect(() => {
    if (!attachedKey) {
      setTicketRecords([]);
      return;
    }
    let alive = true;
    const ids = attachedKey.split(",");
    listRecordsByIds(ids).then((rows) => {
      if (!alive) return;
      // Preserve attachment order (listRecordsByIds returns unordered).
      const byId = new Map((rows || []).map((r) => [r.id, r]));
      setTicketRecords(ids.map((id) => byId.get(id)).filter(Boolean));
    });
    return () => {
      alive = false;
    };
  }, [attachedKey]);

  const tickets = buildTickets(event, ticketRecords);
```

(`useState`/`useEffect` are already imported at the top of the file — confirm and don't re-import.)

- [ ] **Step 4: Confirm the checkout path needs no change**

The chosen ticket's `id` (a `ticket_type` uuid) already flows through `selectedTicket.id` → the checkout POST body `ticketId` → Stripe metadata → `verify/route.js` → `buy_ticket` RPC, and free tickets call `buy_ticket` directly with the same id. Read `app/api/checkout/route.js` and `app/api/checkout/verify/route.js` to confirm `ticketId` is passed through as an opaque string (it is — `String(ticketId)`), so uuid ids need no code change. If either route coerces `ticketId` to a number, stop and flag it — the RPC key must stay a string. Make no edit if the pass-through is opaque.

- [ ] **Step 5: Lint + build**

Run: `npx eslint components/internal/screens/events/event_public_page.jsx`
Expected: no errors.
Run: `npm run build`
Expected: build completes without errors (this is the one significant-UI build for the whole plan).

- [ ] **Step 6: Manual verification**

- Create a ticket under Tickets → Ticket Types (set price + quantity + refund).
- Open an event → Ticket Types tab → attach it.
- Open the event's `/e/<uuid>` page → the attached ticket appears with its price and description; a hidden/out-of-window ticket does not.
- Confirm an event with no attached tickets still shows its legacy tiers (backward compat).

- [ ] **Step 7: Commit**

```bash
git add components/internal/screens/events/event_public_page.jsx
git commit -m "feat: sell attached reusable tickets on the public event page"
```

---

## Self-Review

**Spec coverage:**
- Standalone ticket listing + create with details → Task 2 (`RecordsScreen`, `TicketEditForm`). ✓
- Refund + all other settings on the edit screen → Task 2 (`refund`, `sales`, `visibility`, `accessCode`, `reservedSeating`, min/max, description). ✓
- Attach to any event from the event edit page → Task 3 + Task 4 (`TicketTypeAttachmentsSection`, repointed `tickets` tab). ✓
- `module: "ticket_type"`, `listRecordsByIds` → Task 1. ✓
- Retire embedded editor, delete `inventory_sections.jsx`, preserve Dietary inquiry → Task 4 + Task 3 (moved `AttachInquiryCard`). ✓
- Public sale end-to-end with legacy fallback → Task 5 (gated). ✓
- No SQL change (config jsonb) → honored across all tasks. ✓
- Backward compatibility (legacy `event.tickets` fallback, `metadata.ticketRules` left ignored) → Task 5 buildTickets fallback. ✓
- RLS risk (public-read for records) → Task 5 gate. ✓

**Placeholder scan:** No TBD/TODO. The only non-verbatim step is Task 4 Step 4, which is a deterministic, eslint-verified cleanup with a definite removal list plus named candidates — not a placeholder.

**Type consistency:** `defaultTicketConfig` (function) used consistently in Task 1/2; config shape (`refund.{refundable,cutoffDays,feeHandling}`, `sales.{mode,startAt,endAt}`, `accessCode.{enabled,code}`, `visibility`, `onSaleAt`, `reservedSeating`, `price`, `qty`, `minPerOrder`, `maxPerOrder`, `description`) identical across the edit form (Task 2), attach card reads (`config.price`/`config.qty`, Task 3), and `buildTickets` (Task 5). `TicketTypeAttachmentsSection` name matches between Task 3 (produce) and Task 4 (consume). `listRecordsByIds` signature matches Task 1 (produce) and Task 5 (consume). Attachment key `ticket_type` consistent in Task 3 write and Task 5 read.
