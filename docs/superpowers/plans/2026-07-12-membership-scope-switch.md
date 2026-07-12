# Membership Scope Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-plan "Apply to all events" scope switch to membership plans, and a dedicated Memberships section in the event editor that lists per-event plans (price + discount, read-only) with an enable toggle.

**Architecture:** One new boolean in the membership plan's `config` jsonb bag drives scope. A new event-editor section reads project membership plans, splits them into global (switch on) vs per-event (switch off), and persists per-event enablement under the event's `metadata.attached.membership`. Membership is removed from the generic Ticketing attach list to avoid two surfaces writing the same key.

**Tech Stack:** Next.js 16 (App Router), React client components, Tailwind + shadcn/ui, Lucide icons, Supabase data layer.

## Global Constraints

- No SQL migration — `applyToAllEvents` lives in the existing `ticketing_records.config` jsonb bag; existing rows read `config.applyToAllEvents ?? false`.
- Semantic color tokens only, never hardcoded hex (`bg-surface-card`, `text-text-secondary`, `border-border`, etc.).
- Reuse shared kit (`@/components/internal/shared/screen_kit`) and shadcn primitives (`@/components/ui/*`); Lucide icons.
- All imports use the `@/` root alias.
- The member discount is display-only config — do NOT wire it into checkout/pricing math.
- Per-event enablement key: `metadata.attached.membership` (array of plan ids), accessed via `useEventConfig(event, "attached", {})`.
- Quality gate: `npx eslint <changed files>` must be clean before a task is done. Remove any unused import immediately.
- Do NOT run a build unless verifying a significant UI regression.

---

### Task 1: Add `applyToAllEvents` to the membership plan config default

**Files:**
- Modify: `components/internal/screens/tickets/constants.js` (`defaultMembershipPlanConfig`, ~lines 235-241)

**Interfaces:**
- Produces: `defaultMembershipPlanConfig()` now includes `applyToAllEvents: false`. Consumers read `config.applyToAllEvents ?? false`.

- [ ] **Step 1: Add the flag to the default config**

Replace:

```js
// Membership plan record config (ticketing_records, module "membership").
export const defaultMembershipPlanConfig = () => ({
  price: 0,
  billingPeriod: "yearly", // one-time | monthly | yearly
  benefits: [], // string perks
  discountPercent: 0, // member discount on tickets
  description: "",
});
```

with:

```js
// Membership plan record config (ticketing_records, module "membership").
export const defaultMembershipPlanConfig = () => ({
  price: 0,
  billingPeriod: "yearly", // one-time | monthly | yearly
  benefits: [], // string perks
  discountPercent: 0, // member discount on tickets
  applyToAllEvents: false, // on = discount applies to every event; off = per-event opt-in
  description: "",
});
```

- [ ] **Step 2: Lint**

Run: `npx eslint components/internal/screens/tickets/constants.js`
Expected: clean (no errors).

---

### Task 2: Add the Scope switch to the plan edit form and update the summary

**Files:**
- Modify: `components/internal/screens/memberships/membership_plans.jsx`

**Interfaces:**
- Consumes: `config.applyToAllEvents` (from Task 1's default), `SettingsList`, `SettingRow` from screen_kit.
- Produces: plan editor toggles `applyToAllEvents`; `summarize` appends `· All events` when set.

- [ ] **Step 1: Import `SettingsList` and `SettingRow`**

Replace:

```js
import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
```

with:

```js
import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
```

- [ ] **Step 2: Append scope to the list summary**

Replace the `summarize` body's return:

```js
  const disc = Number(c.discountPercent) || 0;
  return [priceStr, disc ? `${disc}% member discount` : "no discount"].join(" · ");
```

with:

```js
  const disc = Number(c.discountPercent) || 0;
  const parts = [priceStr, disc ? `${disc}% member discount` : "no discount"];
  if (c.applyToAllEvents) parts.push("All events");
  return parts.join(" · ");
```

- [ ] **Step 3: Add a Scope section to the edit form**

In `MembershipPlanEditForm`, insert a new `SectionCard` immediately after the closing `</SectionCard>` of the "Pricing" card and before the "Benefits" card:

```jsx
      <SectionCard
        title="Scope"
        description="Where this membership's discount applies."
      >
        <SettingsList>
          <SettingRow
            icon={BadgeCheck}
            title="Apply to all events"
            description="On applies this discount across every event (rare). Off keeps the plan per-event — enable it on each event's Memberships section."
            checked={!!config.applyToAllEvents}
            onCheckedChange={(v) => set({ applyToAllEvents: v })}
          />
        </SettingsList>
      </SectionCard>
```

(`BadgeCheck` is already imported at the top of this file.)

- [ ] **Step 4: Lint**

Run: `npx eslint components/internal/screens/memberships/membership_plans.jsx`
Expected: clean.

---

### Task 3: Create the dedicated event Memberships section

**Files:**
- Create: `components/internal/screens/events/event_memberships.jsx`

**Interfaces:**
- Consumes: `listRecordsByModules(projectId, ["membership"])` → `[{ id, name, module, active, config }]`; `useEventConfig(event, "attached", {})` → `[value, setLocal, save]`; `currency` from tickets constants.
- Produces: `EventMembershipsSection({ event, headerItem })` (named + default export). Persists enabled plan ids at `attached.membership`.

- [ ] **Step 1: Write the section component**

Create `components/internal/screens/events/event_memberships.jsx` with exactly:

```jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Loader2, Plus } from "lucide-react";

import { EditorSectionHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listRecordsByModules } from "@/lib/supabase/ticketing";
import { currency } from "../tickets/constants";

// Event-editor section: enable membership plans for this event. Plans are
// reusable records (ticketing_records, module "membership"); a plan with
// config.applyToAllEvents already applies everywhere and is shown read-only.
// Per-event plans are toggled on/off, stored under metadata.attached.membership.

function priceLabel(config) {
  const price = Number(config.price) || 0;
  if (price === 0) return "Free";
  const period =
    config.billingPeriod && config.billingPeriod !== "one-time"
      ? `/${config.billingPeriod}`
      : "";
  return `${currency(price)}${period}`;
}

export function EventMembershipsSection({ event, headerItem }) {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const [attached, , save] = useEventConfig(event, "attached", {});
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listRecordsByModules(projectId, ["membership"]).then((rows) => {
      if (!alive) return;
      setPlans((rows ?? []).filter((r) => r.active));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const { perEvent, global } = useMemo(() => {
    const per = [];
    const all = [];
    for (const p of plans) {
      if (p.config?.applyToAllEvents) all.push(p);
      else per.push(p);
    }
    return { perEvent: per, global: all };
  }, [plans]);

  const selected = Array.isArray(attached.membership)
    ? attached.membership
    : [];

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    save({ ...attached, membership: next });
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Memberships"}
        description={
          headerItem?.desc ||
          "Enable membership plans for this event. Members get the plan's discount here. Manage the plans themselves under Membership Plans."
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-12 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading plans…
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-surface-card px-6 py-10">
          <p className="text-sm text-text-secondary">No membership plans yet.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTab("Membership Plans")}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Create one
          </Button>
        </div>
      ) : (
        <>
          {global.length ? (
            <div className="rounded-xl border border-border bg-surface-subtle px-4 py-3 text-xs text-text-secondary">
              <span className="font-medium text-muted-foreground">
                Applies to all events automatically:{" "}
              </span>
              {global.map((p) => p.name).join(", ")}
            </div>
          ) : null}

          {perEvent.length ? (
            <div className="space-y-3">
              {perEvent.map((p) => {
                const on = selected.includes(p.id);
                const disc = Number(p.config?.discountPercent) || 0;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-border bg-surface-card p-4 transition-opacity",
                      on ? "" : "opacity-70",
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                      <BadgeCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {p.name}
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        <span className="tabular-nums">
                          {priceLabel(p.config || {})}
                        </span>
                        {" · "}
                        {disc ? `${disc}% member discount` : "no discount"}
                      </p>
                    </div>
                    <div className="flex items-center self-center">
                      <Switch
                        checked={on}
                        onCheckedChange={() => toggle(p.id)}
                        aria-label={
                          on ? `Disable ${p.name}` : `Enable ${p.name}`
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">
              All membership plans apply to every event. Create a per-event plan
              under Membership Plans to enable it here.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default EventMembershipsSection;
```

- [ ] **Step 2: Verify the imports it depends on exist**

Run: `npx eslint components/internal/screens/events/event_memberships.jsx`
Expected: clean. (If `useWorkspaceUrl` path differs, confirm against `components/internal/screens/tickets/event_attachments.jsx`, which imports the same `setTab`/`listRecordsByModules`/`useEventConfig`/`useProject`.)

---

### Task 4: Register the Memberships section in the event editor nav

**Files:**
- Modify: `components/internal/screens/events/event_sections.js`

**Interfaces:**
- Consumes: `EventMembershipsSection` from Task 3.
- Produces: nav key `memberships` → `EventMembershipsSection`, shown under the Tickets group.

- [ ] **Step 1: Import the section**

After the line:

```js
import { TicketRulesSection } from "../tickets/event_ticket_rules";
```

add:

```js
import { EventMembershipsSection } from "./event_memberships";
```

- [ ] **Step 2: Add the nav entry under the Tickets group**

In the `group: "Tickets"` block's `items` array, add this entry immediately after the `ticketrules` item's closing `},`:

```js
      {
        key: "memberships",
        label: "Memberships",
        icon: BadgeCheck,
        desc: "Enable membership plans for this event — members get the plan's discount here.",
        ownHeader: true,
      },
```

- [ ] **Step 3: Import the `BadgeCheck` icon**

In the `lucide-react` import block at the top of the file, add `BadgeCheck,` to the list (e.g. after `Ticket,`).

- [ ] **Step 4: Map the key to the component**

In the `SECTIONS` object, after the line:

```js
  ticketrules: TicketRulesSection,
```

add:

```js
  memberships: EventMembershipsSection,
```

- [ ] **Step 5: Lint**

Run: `npx eslint components/internal/screens/events/event_sections.js`
Expected: clean.

---

### Task 5: Remove membership from the generic Ticketing attach list

**Files:**
- Modify: `components/internal/screens/tickets/event_attachments.jsx` (`ATTACH_MODULES`, ~line 42)

**Interfaces:**
- Produces: memberships no longer appear in the generic Ticketing attach section; they are managed only in the dedicated Memberships section.

- [ ] **Step 1: Delete the membership entry**

Remove this line from the `ATTACH_MODULES` array:

```js
  { module: "membership", label: "Memberships", icon: BadgeCheck, tab: "Membership Plans" },
```

- [ ] **Step 2: Remove the now-unused `BadgeCheck` import**

In the `lucide-react` import block of this file, delete `BadgeCheck,` (it was used only by the removed entry). Leave the other icons intact.

- [ ] **Step 3: Lint**

Run: `npx eslint components/internal/screens/tickets/event_attachments.jsx`
Expected: clean (no unused-import error for `BadgeCheck`).

---

### Task 6: Final lint sweep across all touched files

**Files:** all of the above.

- [ ] **Step 1: Lint every changed file together**

Run:

```bash
npx eslint components/internal/screens/tickets/constants.js components/internal/screens/memberships/membership_plans.jsx components/internal/screens/events/event_memberships.jsx components/internal/screens/events/event_sections.js components/internal/screens/tickets/event_attachments.jsx
```

Expected: clean, no errors or warnings.

- [ ] **Step 2: Manual sanity check (no build required)**

Confirm by reading:
- A membership plan editor shows a **Scope** card with the "Apply to all events" switch.
- The event editor's Tickets group shows a **Memberships** entry; opening it lists per-event plans with price + discount and an enable toggle, and shows a read-only banner for any all-events plans.
- The generic **Ticketing** attach section no longer lists Memberships.

---

## Self-Review

**Spec coverage:**
- Scope flag (`applyToAllEvents`) — Task 1. ✓
- Switch on plan + summary hint — Task 2. ✓
- Dedicated event Memberships section (per-event cards w/ price+discount + toggle; global banner; loading/empty states; read-only) — Task 3. ✓
- Nav registration under Tickets — Task 4. ✓
- De-duplicate generic attach — Task 5. ✓
- Reuse `attached.membership` key — Task 3 (`save({ ...attached, membership: next })`). ✓
- No SQL migration — respected (config bag only). ✓

**Type/name consistency:** `EventMembershipsSection` used identically in Tasks 3 and 4; nav key `memberships` matches the `SECTIONS` map key; `attached.membership` key consistent across write (Task 3) and removal of duplicate writer (Task 5). ✓

**Placeholder scan:** none — every step carries full code. ✓
