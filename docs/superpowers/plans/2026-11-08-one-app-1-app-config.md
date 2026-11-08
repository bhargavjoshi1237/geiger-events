# One App — Phase 1: One App Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard's Branded App the single, persisted configuration for the Geiger Events mobile app, and make `mobile/` obey it (sections, home welcome, home shortcuts). Retire the Mobile Event App screen.

**Architecture:** A pure config model (`lib/app_config/model.js`) is shared by the dashboard and the server. The dashboard writes one row per project to a new `events.app_configs` table, using RLS like `design_settings`. A portal route merges the configs of every project the signed-in member is connected to (union of sections) and serves them to the app. The app holds the merged config in a context provider that defaults to "everything on" until the server answers.

**Tech Stack:** Next.js 16 (App Router, plain JS), Supabase (`events` schema, geiger-orm migrations), `@geiger/ui`, Expo SDK 57 / RN 0.86 / expo-router (TypeScript strict).

**Design:** `docs/superpowers/specs/2026-11-08-one-app-design.md` (§4). Re-read it if a task's intent is unclear.

## Global Constraints

- Root code is plain JS ESM. Tests use `node:test` + `node:assert/strict`, run as `node --test <file>`. There is no test script; do not add one. Route tests mock `@/…` specifiers with `registerHooks` (see `lib/portal/request_setup.test.js`).
- Migrations are geiger-orm files with `-- @up` / `-- @down`. **Never run `npm run db:push` yourself.** Run `npm run db:status` (read-only), then ask the user to run `! cd D:/geiger-work/one-app && npm run db:push`.
- Mobile follows `mobile/AGENTS.md`:
  - every colour comes from `@/theme/tokens`;
  - `StyleSheet.create` sits at the bottom of the file;
  - build from `@/components/ui/*` primitives;
  - lucide icons are registered in `components/ui/icons.tsx`;
  - every touchable has a11y props;
  - no mock data;
  - imports use the `@/*` alias.
- Mobile verification is `cd mobile && npx tsc --noEmit` plus `npm run lint:mobile` from the repo root. There is no mobile test runner.
- Dashboard UI:
  - use `@geiger/ui` / screen-kit components;
  - use `LogoLoading` (no `name` prop, sized 40–56) for section loaders;
  - keep it flat: no gradients, glows or eyebrow labels.
- Comments are concise, single-line, and explain *why*.
- **Commits:** commit each task on branch `feat/one-app` (this worktree, `D:/geiger-work/one-app`), staging only the task's own files by path — never `git add -A` / `git add .`. Never push, never touch `main`; the user decides when to merge.
- Do not screenshot or drive the UI yourself. Lint and typecheck, then hand the device check to the user.

---

### Task 1: Config model

**Files:**
- Create: `lib/app_config/model.js`
- Test: `lib/app_config/model.test.js`

**Interfaces:**
- Produces:
  - `SECTION_KEYS: string[]` (14 keys)
  - `UPCOMING_SECTIONS: string[]`
  - `SHORTCUT_KEYS: string[]`
  - `MAX_SHORTCUTS = 4`
  - `DEFAULT_APP_CONFIG`
  - `normalizeShortcuts(value, sections) → string[]`
  - `normalizeAppConfig(raw) → { version, sections, home, whiteLabel }`
  - `mergeForMember(configs: (object|null)[]) → { sections, home }`

- [ ] **Step 1: Write the failing test**

Create `lib/app_config/model.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_APP_CONFIG,
  MAX_SHORTCUTS,
  SECTION_KEYS,
  mergeForMember,
  normalizeAppConfig,
} from "./model.js";

test("missing or junk input normalises to the all-on defaults", () => {
  for (const raw of [null, undefined, "x", [], {}]) {
    const c = normalizeAppConfig(raw);
    assert.equal(c.version, 1);
    for (const key of SECTION_KEYS) assert.equal(c.sections[key], true, key);
    assert.deepEqual(c.home, { welcome: "", liveStrip: true, recentOrders: true, shortcuts: ["community", "watch", "memberships"] });
    assert.deepEqual(c.whiteLabel, DEFAULT_APP_CONFIG.whiteLabel);
  }
});

test("explicit false toggles survive; unknown keys and non-booleans are ignored", () => {
  const c = normalizeAppConfig({ sections: { networking: false, watch: "no", bogus: false }, home: { liveStrip: false } });
  assert.equal(c.sections.networking, false);
  assert.equal(c.sections.watch, true);
  assert.equal("bogus" in c.sections, false);
  assert.equal(c.home.liveStrip, false);
  assert.equal(c.home.recentOrders, true);
});

test("welcome is trimmed and capped at 280 characters", () => {
  assert.equal(normalizeAppConfig({ home: { welcome: "  Hi  " } }).home.welcome, "Hi");
  assert.equal(normalizeAppConfig({ home: { welcome: "x".repeat(400) } }).home.welcome.length, 280);
});

test("shortcuts drop unknown, disabled and duplicate keys and cap at the maximum", () => {
  const c = normalizeAppConfig({
    sections: { watch: false },
    home: { shortcuts: ["qa", "watch", "qa", "agenda", "live", "orders", "community", "memberships"] },
  });
  assert.deepEqual(c.home.shortcuts, ["qa", "live", "orders", "community"]);
  assert.equal(c.home.shortcuts.length, MAX_SHORTCUTS);
  assert.deepEqual(normalizeAppConfig({ home: { shortcuts: [] } }).home.shortcuts, []);
});

test("white-label fields fall back on bad enum values and cap strings", () => {
  const c = normalizeAppConfig({ whiteLabel: { themeMode: "neon", androidFormat: "ipa", appName: "a".repeat(200), accent: "#10b981" } });
  assert.equal(c.whiteLabel.themeMode, "dark");
  assert.equal(c.whiteLabel.androidFormat, "apk");
  assert.equal(c.whiteLabel.appName.length, 80);
  assert.equal(c.whiteLabel.accent, "#10b981");
});

test("a member with no connected projects sees everything", () => {
  const m = mergeForMember([]);
  for (const key of SECTION_KEYS) assert.equal(m.sections[key], true, key);
  assert.deepEqual(m.home.shortcuts, ["community", "watch", "memberships"]);
  assert.equal("whiteLabel" in m, false);
});

test("a section stays on when any connected project leaves it on", () => {
  const m = mergeForMember([
    { sections: { networking: false, watch: false } },
    { sections: { networking: false } },
  ]);
  assert.equal(m.sections.networking, false);
  assert.equal(m.sections.watch, true);
});

test("a project that never saved a config counts as all-on", () => {
  const m = mergeForMember([{ sections: { networking: false } }, null]);
  assert.equal(m.sections.networking, true);
});

test("welcome and shortcuts come from the project only when it is the member's only one", () => {
  const solo = mergeForMember([{ home: { welcome: "Hello DevCon", shortcuts: ["live", "qa"] } }]);
  assert.equal(solo.home.welcome, "Hello DevCon");
  assert.deepEqual(solo.home.shortcuts, ["live", "qa"]);

  const many = mergeForMember([{ home: { welcome: "Hello DevCon", shortcuts: ["live"] } }, null]);
  assert.equal(many.home.welcome, "");
  assert.deepEqual(many.home.shortcuts, ["community", "watch", "memberships"]);
});

test("merged shortcuts never point at a section that is off everywhere", () => {
  const m = mergeForMember([{ sections: { watch: false }, home: { shortcuts: ["watch", "live"] } }]);
  assert.deepEqual(m.home.shortcuts, ["live"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/app_config/model.test.js`
Expected: FAIL with `Cannot find module` … `lib/app_config/model.js`.

- [ ] **Step 3: Write the implementation**

Create `lib/app_config/model.js`:

```js
// The one Geiger Events app's per-project configuration: which sections show, the home screen, and white-label build settings.

export const SECTION_KEYS = [
  "memberships",
  "live",
  "watch",
  "orders",
  "community",
  "qa",
  "messages",
  "notifications",
  "agenda",
  "speakers",
  "sponsors",
  "map",
  "networking",
  "discussions",
];

// Saved now so organisers can decide early; the app renders them as each one ships (design §5, Phase 5).
export const UPCOMING_SECTIONS = ["agenda", "speakers", "sponsors", "map", "networking", "discussions"];

export const SHORTCUT_KEYS = ["community", "watch", "memberships", "live", "orders", "qa"];

export const MAX_SHORTCUTS = 4;

const WELCOME_MAX = 280;

const THEME_MODES = ["dark", "light", "system"];
const ANDROID_FORMATS = ["apk", "aab"];
const IOS_METHODS = ["testflight", "store"];

const WHITE_LABEL_TEXT = {
  appName: 80,
  orgName: 120,
  tagline: 160,
  slug: 60,
  scheme: 40,
  version: 20,
  iosBundleId: 120,
  androidPackage: 120,
  easProjectId: 60,
  accent: 9,
  background: 9,
  card: 9,
  primary: 9,
  splashBackground: 9,
  splashMessage: 160,
  iosUrl: 500,
  androidUrl: 500,
  releaseNotes: 1000,
};

const DEFAULT_SHORTCUTS = ["community", "watch", "memberships"];

export const DEFAULT_APP_CONFIG = {
  version: 1,
  sections: Object.fromEntries(SECTION_KEYS.map((key) => [key, true])),
  home: { welcome: "", liveStrip: true, recentOrders: true, shortcuts: DEFAULT_SHORTCUTS },
  whiteLabel: {
    appName: "",
    orgName: "",
    tagline: "",
    slug: "",
    scheme: "",
    version: "1.0.0",
    iosBundleId: "",
    androidPackage: "",
    easProjectId: "",
    themeMode: "dark",
    accent: "#6366f1",
    background: "#161616",
    card: "#202020",
    primary: "#ffffff",
    splashBackground: "#161616",
    splashMessage: "",
    iosUrl: "",
    androidUrl: "",
    androidFormat: "apk",
    iosMethod: "testflight",
    releaseNotes: "",
  },
};

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const text = (value, max, fallback) => (typeof value === "string" ? value.trim().slice(0, max) : fallback);

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export function normalizeShortcuts(value, sections) {
  const list = Array.isArray(value) ? value : DEFAULT_SHORTCUTS;
  const out = [];
  for (const key of list) {
    if (out.length === MAX_SHORTCUTS) break;
    if (SHORTCUT_KEYS.includes(key) && sections[key] && !out.includes(key)) out.push(key);
  }
  return out;
}

export function normalizeAppConfig(raw) {
  const source = isObject(raw) ? raw : {};
  const rawSections = isObject(source.sections) ? source.sections : {};
  const sections = Object.fromEntries(
    SECTION_KEYS.map((key) => [key, typeof rawSections[key] === "boolean" ? rawSections[key] : true]),
  );

  const rawHome = isObject(source.home) ? source.home : {};
  const home = {
    welcome: text(rawHome.welcome, WELCOME_MAX, ""),
    liveStrip: rawHome.liveStrip !== false,
    recentOrders: rawHome.recentOrders !== false,
    shortcuts: normalizeShortcuts(rawHome.shortcuts, sections),
  };

  const rawWhiteLabel = isObject(source.whiteLabel) ? source.whiteLabel : {};
  const defaults = DEFAULT_APP_CONFIG.whiteLabel;
  const whiteLabel = { ...defaults };
  for (const [key, max] of Object.entries(WHITE_LABEL_TEXT)) {
    whiteLabel[key] = text(rawWhiteLabel[key], max, defaults[key]);
  }
  whiteLabel.themeMode = oneOf(rawWhiteLabel.themeMode, THEME_MODES, defaults.themeMode);
  whiteLabel.androidFormat = oneOf(rawWhiteLabel.androidFormat, ANDROID_FORMATS, defaults.androidFormat);
  whiteLabel.iosMethod = oneOf(rawWhiteLabel.iosMethod, IOS_METHODS, defaults.iosMethod);

  return { version: 1, sections, home, whiteLabel };
}

// What the shared app shows a member: a section is on when any connected project leaves it on; projects with no saved config count as defaults.
export function mergeForMember(configs) {
  const list = (configs.length ? configs : [null]).map(normalizeAppConfig);
  const sections = Object.fromEntries(SECTION_KEYS.map((key) => [key, list.some((c) => c.sections[key])]));
  const only = list.length === 1 ? list[0] : null;
  return {
    sections,
    home: {
      welcome: only ? only.home.welcome : "",
      liveStrip: list.some((c) => c.home.liveStrip),
      recentOrders: list.some((c) => c.home.recentOrders),
      shortcuts: normalizeShortcuts(only ? only.home.shortcuts : DEFAULT_SHORTCUTS, sections),
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/app_config/model.test.js`
Expected: PASS, 10 tests, 0 failures.

- [ ] **Step 5: Lint**

Run: `npx eslint lib/app_config`
Expected: no errors.

---

### Task 2: `events.app_configs` migration

**Files:**
- Create: `supabase/migrations/20261108230000_app_configs.sql`

**Interfaces:**
- Produces the table `events.app_configs(project_id uuid unique, config jsonb, updated_by uuid, created_at, updated_at)`. Read by Task 3 (dashboard, RLS) and Task 5 (portal, service role).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20261108230000_app_configs.sql`:

```sql
-- @up
-- One mobile-app configuration per project (sections, home, white-label build settings). Shape: lib/app_config/model.js.

create schema if not exists events;

create table if not exists events.app_configs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists app_configs_touch on events.app_configs;
create trigger app_configs_touch
  before update on events.app_configs
  for each row execute function events.touch_updated_at();

alter table events.app_configs enable row level security;

drop policy if exists app_configs_member_all on events.app_configs;
create policy app_configs_member_all on events.app_configs
  for all
  to authenticated
  using (events.can_access_project(project_id))
  with check (events.can_access_project(project_id));

grant select, insert, update, delete on events.app_configs to authenticated;

-- Carry over the retired Mobile Event App screen's singleton so nobody loses their toggles.
-- That screen auto-created its row with placeholder copy on first visit, so its untouched defaults are dropped, not copied to phones.
insert into events.app_configs (project_id, config)
select distinct on (r.project_id)
  r.project_id,
  jsonb_build_object(
    'version', 1,
    'sections', jsonb_strip_nulls(jsonb_build_object(
      'agenda', r.config -> 'tabs' -> 'agenda',
      'speakers', r.config -> 'tabs' -> 'speakers',
      'map', r.config -> 'tabs' -> 'maps',
      'networking', r.config -> 'tabs' -> 'networking',
      'sponsors', r.config -> 'tabs' -> 'sponsors',
      'live', r.config -> 'tabs' -> 'live',
      'notifications', r.config -> 'tabs' -> 'notifications'
    )),
    'home', jsonb_strip_nulls(jsonb_build_object(
      'welcome', nullif(r.config ->> 'splashMessage', 'Welcome! Tap Agenda to plan your day.')
    )),
    'whiteLabel', jsonb_strip_nulls(jsonb_build_object(
      'appName', nullif(r.config ->> 'appName', 'Event App'),
      'tagline', nullif(r.config ->> 'tagline', 'Everything you need, in your pocket.'),
      'accent', r.config ->> 'accent',
      'iosUrl', r.config ->> 'iosUrl',
      'androidUrl', r.config ->> 'androidUrl'
    ))
  )
from events.conference_records r
where r.module = 'mobile_app'
  and r.deleted_at is null
  and r.project_id is not null
order by r.project_id, r.updated_at desc
on conflict (project_id) do nothing;

-- @down
drop table if exists events.app_configs;
```

- [ ] **Step 2: Check it is pending**

Run: `npm run db:status`
Expected: `20261108230000_app_configs.sql` is listed as pending, and no other drift is reported.

- [ ] **Step 3: Hand off the push**

Tell the user: "Migration `20261108230000_app_configs.sql` is ready. Please run `! npm run db:push`." Do not run it yourself. Tasks 3–7 can be written before the push. Only the user's on-device check needs it.

---

### Task 3: Dashboard data layer

**Files:**
- Create: `lib/supabase/app_config.js`

**Interfaces:**
- Consumes: `normalizeAppConfig` (Task 1); `createClient` from `lib/supabase/client.js`; `isSupabaseConfigured` from `lib/supabase/events.js`.
- Produces:
  - `getAppConfig(projectId) → Promise<{ config, updatedAt } | null>`. Returns `null` only when the read failed or there is no project. A missing row returns the defaults.
  - `saveAppConfig(projectId, config, { userId }) → Promise<{ config, updatedAt } | null>`.

- [ ] **Step 1: Write the module**

Create `lib/supabase/app_config.js`:

```js
"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { normalizeAppConfig } from "@/lib/app_config/model";

// Data-access layer for events.app_configs — the project's mobile app configuration (one row per project). Never throws.

const TABLE = "app_configs";

// The project's config (defaults when no row exists yet), or null when the read failed.
export async function getAppConfig(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("config, updated_at")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      console.error("[app_config.get]", error.message);
      return null;
    }
    return { config: normalizeAppConfig(data?.config), updatedAt: data?.updated_at ?? null };
  } catch (e) {
    console.error("[app_config.get]", e);
    return null;
  }
}

// Saves the whole config (create-on-first-write); returns the stored config or null.
export async function saveAppConfig(projectId, config, { userId = null } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .upsert(
        { project_id: projectId, config: normalizeAppConfig(config), updated_by: userId },
        { onConflict: "project_id" },
      )
      .select("config, updated_at")
      .single();
    if (error) {
      console.error("[app_config.save]", error.message);
      return null;
    }
    return { config: normalizeAppConfig(data.config), updatedAt: data.updated_at };
  } catch (e) {
    console.error("[app_config.save]", e);
    return null;
  }
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint lib/supabase/app_config.js`
Expected: no errors.

---

### Task 4: Branded App persists, absorbs Mobile Event App

**Files:**
- Replace: `components/internal/screens/branded/branded_app.jsx` (full rewrite)
- Delete: `components/internal/screens/conference/mobile_app.jsx`
- Modify:
  - `components/internal/screens/conference/screens.jsx:8-15`
  - `components/internal/screens/conference/modules/index.js:7`
  - `components/internal/screens/registry.jsx:124`, `:425-427`
  - `components/internal/sidebar/sidebar_nav.jsx:87`, `:472`
  - `components/landing/playground_screen_host.jsx:10`

**Interfaces:**
- Consumes: Task 1 (`MAX_SHORTCUTS`, `SHORTCUT_KEYS`, `normalizeAppConfig`) and Task 3 (`getAppConfig`, `saveAppConfig`).
- Produces: `BrandedAppScreen` (default and named export), which the registry already imports.

- [ ] **Step 1: Rewrite the screen**

Replace the whole contents of `components/internal/screens/branded/branded_app.jsx` with:

```jsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Award,
  Bell,
  CalendarDays,
  Download,
  Handshake,
  HelpCircle,
  Home,
  Inbox,
  Map as MapIcon,
  Menu,
  MessageSquare,
  MessagesSquare,
  Mic,
  Play,
  Radio,
  ShoppingBag,
  Ticket,
  Users,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  ScreenHeader,
  SectionCard,
  SegmentedTabs,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button, Input, LogoLoading, Textarea, cn } from "@geiger/ui";
import { useOptionalProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { getAppConfig, saveAppConfig } from "@/lib/supabase/app_config";
import { MAX_SHORTCUTS, SHORTCUT_KEYS, normalizeAppConfig } from "@/lib/app_config/model";

// One app for every attendee: this screen decides what it shows for this project's events (events.app_configs).

const APP_SECTIONS = [
  { key: "memberships", label: "Memberships", desc: "Plans, perks and renewals — its own tab.", icon: Award },
  { key: "live", label: "Live rooms", desc: "Livestreams, webinars and breakouts.", icon: Radio },
  { key: "watch", label: "Watch", desc: "Recordings, simulive premieres and replays.", icon: Play },
  { key: "orders", label: "Orders", desc: "Order history, receipts and refund status.", icon: ShoppingBag },
  { key: "community", label: "Group chats", desc: "Event chat channels and polls.", icon: MessagesSquare },
  { key: "qa", label: "Q&A", desc: "Session questions and upvotes.", icon: HelpCircle },
  { key: "messages", label: "Organiser messages", desc: "Attendee ↔ organiser support threads.", icon: MessageSquare },
  { key: "notifications", label: "Updates", desc: "Announcements you send.", icon: Bell },
];

const CONFERENCE_SECTIONS = [
  { key: "agenda", label: "Agenda", desc: "The schedule and each attendee's picks.", icon: CalendarDays },
  { key: "speakers", label: "Speakers", desc: "Speaker profiles and their sessions.", icon: Mic },
  { key: "sponsors", label: "Sponsors", desc: "Sponsors and their resources.", icon: Handshake },
  { key: "map", label: "Map", desc: "Venue map and the expo floor plan.", icon: MapIcon },
  { key: "networking", label: "Networking", desc: "Attendee directory and meeting requests.", icon: Users },
  { key: "discussions", label: "Discussions", desc: "Discussion boards.", icon: MessagesSquare },
];

const SHORTCUT_META = {
  community: { label: "Group chat", icon: MessagesSquare },
  watch: { label: "Watch", icon: Play },
  memberships: { label: "Membership", icon: Award },
  live: { label: "Live", icon: Radio },
  orders: { label: "Orders", icon: ShoppingBag },
  qa: { label: "Q&A", icon: HelpCircle },
};

const PREVIEW_TABS = [
  { key: "home", label: "Home", icon: Home },
  { key: "tickets", label: "Tickets", icon: Ticket },
  { key: "memberships", label: "Memberships", icon: Award },
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "more", label: "More", icon: Menu },
];

const THEME_TABS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

const ANDROID_FORMAT_TABS = [
  { value: "apk", label: "APK" },
  { value: "aab", label: "AAB" },
];

const IOS_METHOD_TABS = [
  { value: "testflight", label: "TestFlight" },
  { value: "store", label: "App Store" },
];

const SAVE_STATES = {
  saved: { label: "Saved", variant: "success", dotClass: "bg-emerald-400" },
  saving: { label: "Saving…", variant: "neutral", dotClass: "bg-[#737373]" },
  unsaved: { label: "Unsaved", variant: "neutral", dotClass: "bg-[#737373]" },
  error: { label: "Not saved", variant: "warning", dotClass: "bg-amber-400" },
};

const SAVE_DELAY_MS = 600;

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PhonePreview({ config }) {
  const tabs = PREVIEW_TABS.filter((t) => t.key !== "memberships" || config.sections.memberships);
  const shortcuts = config.home.shortcuts.map((key) => ({ key, ...SHORTCUT_META[key] }));

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[2.75rem] border-[6px] border-border bg-background">
        <div className="absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-[#2a2a2a]" />
        <div className="space-y-2.5 px-4 pb-4 pt-10">
          <div>
            <p className="text-[10px] text-text-secondary">Good evening,</p>
            <p className="text-lg font-semibold leading-tight text-foreground">Alex</p>
          </div>
          {config.home.welcome ? (
            <div className="rounded-xl border border-border bg-surface-subtle p-3 text-xs text-foreground">
              {config.home.welcome}
            </div>
          ) : null}
          {config.home.liveStrip && config.sections.live ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-card px-3 py-2.5 text-xs font-medium text-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live now — Main Stage
            </div>
          ) : null}
          {shortcuts.length ? (
            <div className="grid grid-cols-2 gap-2">
              {shortcuts.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.key}
                    className="flex items-center gap-2 rounded-xl border border-border bg-surface-card px-2.5 py-2"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                    <span className="truncate text-[11px] font-medium text-foreground">{s.label}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-surface-subtle px-2 py-2">
          <div className="flex items-center justify-around">
            {tabs.map((t, i) => {
              const Icon = t.icon;
              const tone = i === 0 ? "text-foreground" : "text-text-tertiary";
              return (
                <div key={t.key} className="flex flex-col items-center gap-1">
                  <Icon className={cn("h-4 w-4", tone)} />
                  <span className={cn("text-[9px] font-medium", tone)}>{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({ label, hint, value, placeholder, onChange }) {
  return (
    <Field label={label} hint={hint}>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function ColorField({ label, hint, value, onChange }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <span className="h-8 w-8 shrink-0 rounded-lg border border-border" style={{ background: value }} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </Field>
  );
}

export function BrandedAppScreen() {
  const projectId = useOptionalProject()?.projectId ?? null;
  // Keyed by project so a project switch shows the loader instead of the previous project's settings.
  const [loaded, setLoaded] = useState({ projectId: undefined, config: null });
  const [saveState, setSaveState] = useState("saved");
  const configRef = useRef(null);
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const userIdRef = useRef(null);

  const config = loaded.projectId === projectId ? loaded.config : null;

  useEffect(() => {
    let alive = true;
    Promise.all([getAppConfig(projectId), getUser()]).then(([res, user]) => {
      if (!alive) return;
      userIdRef.current = user?.id ?? null;
      const next = res?.config ?? normalizeAppConfig(null);
      configRef.current = next;
      setLoaded({ projectId, config: next });
      if (!res && projectId) toast.error("Couldn't load the app settings — showing defaults.");
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (!next || !projectId) return;
    setSaveState("saving");
    const saved = await saveAppConfig(projectId, next, { userId: userIdRef.current });
    // A newer edit is already queued; its own save reports the state.
    if (pendingRef.current) return;
    setSaveState(saved ? "saved" : "error");
    if (!saved) toast.error("Couldn't save the app settings.");
  }, [projectId]);

  // Save whatever is still queued when leaving the screen or switching project.
  useEffect(() => () => void flush(), [flush]);

  const update = (change) => {
    const next = change(configRef.current);
    configRef.current = next;
    pendingRef.current = next;
    setLoaded({ projectId, config: next });
    setSaveState("unsaved");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  const setSection = (key) => (on) =>
    update((c) => {
      const sections = { ...c.sections, [key]: on };
      return { ...c, sections, home: { ...c.home, shortcuts: c.home.shortcuts.filter((s) => sections[s]) } };
    });
  const setHome = (partial) => update((c) => ({ ...c, home: { ...c.home, ...partial } }));
  const setWhiteLabel = (partial) => update((c) => ({ ...c, whiteLabel: { ...c.whiteLabel, ...partial } }));

  const toggleShortcut = (key) => (on) => {
    const current = configRef.current.home.shortcuts;
    if (on && current.length >= MAX_SHORTCUTS) {
      toast.message(`Home fits ${MAX_SHORTCUTS} shortcuts — turn one off first.`);
      return;
    }
    setHome({ shortcuts: on ? [...current, key] : current.filter((s) => s !== key) });
  };

  const description =
    "One app for every attendee. Choose what it shows for this project's events — changes reach phones the next time the app opens.";

  if (!config) {
    return (
      <MainScreenWrapper>
        <ScreenHeader title="Branded App" description={description} />
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} label="Loading app settings" />
        </div>
      </MainScreenWrapper>
    );
  }

  const wl = config.whiteLabel;
  const shortcutOptions = SHORTCUT_KEYS.filter((key) => config.sections[key]);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Branded App"
        description={description}
        actions={
          <div className="flex items-center gap-2">
            {projectId ? <StatusPill status={saveState} map={SAVE_STATES} /> : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                downloadJson(`${wl.slug || "geiger-app"}.app-config.json`, {
                  $schema: "geiger.app-config/v1",
                  ...normalizeAppConfig(config),
                })
              }
            >
              <Download className="mr-1.5 h-4 w-4" /> Export config
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <SectionCard
            title="Sections"
            description="Turn off what this project doesn't use. Someone with tickets from several organisers sees a section if any of them leaves it on."
          >
            <SettingsList>
              {APP_SECTIONS.map((s) => (
                <SettingRow
                  key={s.key}
                  icon={s.icon}
                  title={s.label}
                  description={s.desc}
                  checked={config.sections[s.key]}
                  onCheckedChange={setSection(s.key)}
                />
              ))}
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Conference sections"
            description="Saved now; each one appears in the app as it ships."
          >
            <SettingsList>
              {CONFERENCE_SECTIONS.map((s) => (
                <SettingRow
                  key={s.key}
                  icon={s.icon}
                  title={s.label}
                  description={s.desc}
                  checked={config.sections[s.key]}
                  onCheckedChange={setSection(s.key)}
                />
              ))}
            </SettingsList>
          </SectionCard>

          <SectionCard title="Home screen" description="What attendees see first when they open the app.">
            <div className="space-y-4">
              <Field label="Welcome message" hint="Shown at the top of Home when this is the attendee's only organiser.">
                <Textarea
                  rows={2}
                  maxLength={280}
                  value={config.home.welcome}
                  onChange={(e) => setHome({ welcome: e.target.value })}
                  placeholder="e.g. Doors open at 9 — grab a coffee by the main stage."
                />
              </Field>
              <SettingsList>
                <SettingRow
                  icon={Radio}
                  title="Live strip"
                  description="Rooms that are live right now, pinned under the next event."
                  checked={config.home.liveStrip}
                  onCheckedChange={(on) => setHome({ liveStrip: on })}
                />
                <SettingRow
                  icon={ShoppingBag}
                  title="Recent orders"
                  description="The three latest orders at the bottom of Home."
                  checked={config.home.recentOrders}
                  onCheckedChange={(on) => setHome({ recentOrders: on })}
                />
              </SettingsList>
              <Field label="Shortcuts" hint={`Up to ${MAX_SHORTCUTS}, in the order you turn them on.`}>
                <SettingsList>
                  {shortcutOptions.map((key) => {
                    const meta = SHORTCUT_META[key];
                    const position = config.home.shortcuts.indexOf(key);
                    return (
                      <SettingRow
                        key={key}
                        icon={meta.icon}
                        title={meta.label}
                        description={position >= 0 ? `Shortcut ${position + 1}` : "Not on Home"}
                        checked={position >= 0}
                        onCheckedChange={toggleShortcut(key)}
                      />
                    );
                  })}
                </SettingsList>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="White-label build"
            description="Only used when this organiser gets their own app in the stores. The shared Geiger Events app keeps Geiger's name and look."
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="App name" value={wl.appName} placeholder="e.g. Acme Events" onChange={(v) => setWhiteLabel({ appName: v })} />
                <TextField label="Organisation" value={wl.orgName} placeholder="e.g. Acme Organisation" onChange={(v) => setWhiteLabel({ orgName: v })} />
              </div>
              <TextField label="Tagline" value={wl.tagline} placeholder="A short welcome line" onChange={(v) => setWhiteLabel({ tagline: v })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Slug" value={wl.slug} placeholder="acme-events" onChange={(v) => setWhiteLabel({ slug: v })} />
                <TextField label="Deep-link scheme" hint="e.g. acmeevents://tickets/123." value={wl.scheme} placeholder="acmeevents" onChange={(v) => setWhiteLabel({ scheme: v })} />
                <TextField label="iOS bundle id" value={wl.iosBundleId} placeholder="com.acme.events" onChange={(v) => setWhiteLabel({ iosBundleId: v })} />
                <TextField label="Android package" value={wl.androidPackage} placeholder="com.acme.events" onChange={(v) => setWhiteLabel({ androidPackage: v })} />
                <TextField label="Version" value={wl.version} placeholder="1.0.0" onChange={(v) => setWhiteLabel({ version: v })} />
                <TextField label="EAS project id" value={wl.easProjectId} placeholder="xxxxxxxx-xxxx-…" onChange={(v) => setWhiteLabel({ easProjectId: v })} />
              </div>
              <Field label="Appearance">
                <SegmentedTabs tabs={THEME_TABS} value={wl.themeMode} onChange={(v) => setWhiteLabel({ themeMode: v })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Accent" value={wl.accent} onChange={(v) => setWhiteLabel({ accent: v })} />
                <ColorField label="Background" value={wl.background} onChange={(v) => setWhiteLabel({ background: v })} />
                <ColorField label="Card" value={wl.card} onChange={(v) => setWhiteLabel({ card: v })} />
                <ColorField label="Active tab" value={wl.primary} onChange={(v) => setWhiteLabel({ primary: v })} />
                <ColorField label="Splash background" value={wl.splashBackground} onChange={(v) => setWhiteLabel({ splashBackground: v })} />
                <TextField label="Splash message" value={wl.splashMessage} placeholder="Shown on first launch…" onChange={(v) => setWhiteLabel({ splashMessage: v })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Android artifact">
                  <SegmentedTabs tabs={ANDROID_FORMAT_TABS} value={wl.androidFormat} onChange={(v) => setWhiteLabel({ androidFormat: v })} />
                </Field>
                <Field label="iOS distribution">
                  <SegmentedTabs tabs={IOS_METHOD_TABS} value={wl.iosMethod} onChange={(v) => setWhiteLabel({ iosMethod: v })} />
                </Field>
                <TextField label="Google Play / APK link" value={wl.androidUrl} placeholder="https://play.google.com/…" onChange={(v) => setWhiteLabel({ androidUrl: v })} />
                <TextField label="App Store / TestFlight link" value={wl.iosUrl} placeholder="https://apps.apple.com/…" onChange={(v) => setWhiteLabel({ iosUrl: v })} />
              </div>
              <Field label="Release notes">
                <Textarea
                  rows={2}
                  value={wl.releaseNotes}
                  onChange={(e) => setWhiteLabel({ releaseNotes: e.target.value })}
                  placeholder="What's new in this build…"
                />
              </Field>
            </div>
          </SectionCard>
        </div>

        <aside className="min-w-0">
          <div className="lg:sticky lg:top-0">
            <p className="mb-3 text-center text-xs font-medium text-text-secondary">Preview</p>
            <PhonePreview config={config} />
          </div>
        </aside>
      </div>
    </MainScreenWrapper>
  );
}

export default BrandedAppScreen;
```

- [ ] **Step 2: Retire the Mobile Event App screen**

Delete `components/internal/screens/conference/mobile_app.jsx`.

In `components/internal/screens/conference/screens.jsx`:

- Replace:
  ```js
  // are re-exported here: Agenda Builder (event → schedule), Floor Plan & Booths
  // (interactive expo map), Mobile Event App (singleton config + live preview).
  ```
  with:
  ```js
  // are re-exported here: Agenda Builder (event → schedule) and Floor Plan & Booths
  // (interactive expo map).
  ```
- Delete the line `export { MobileAppScreen } from "./mobile_app";`.

In `components/internal/screens/conference/modules/index.js`, replace:

```js
// Bespoke screens (Agenda Builder, Floor Plan & Booths, Mobile Event App) live
```

with:

```js
// Bespoke screens (Agenda Builder, Floor Plan & Booths) live
```

In `components/internal/screens/registry.jsx`:

- Delete the line `  MobileAppScreen,` from the `./conference/screens` import.
- Delete the line `  "Mobile Event App": MobileAppScreen,`.
- In the comment above `"Assign Agenda"`, replace `Floor Plan & Mobile App are bespoke files.` with `Floor Plan is a bespoke file.`

In `components/internal/sidebar/sidebar_nav.jsx`:

- Delete the line `      { title: "Mobile Event App", icon: Smartphone },`.
- Line 87's `Smartphone,` import is then unused. Remove it from the lucide import list. First confirm with `grep -n "Smartphone" components/internal/sidebar/sidebar_nav.jsx` that the only remaining hit is the import.

In `components/landing/playground_screen_host.jsx`, replace:

```js
// it (Insights, Floor Plan & Booths, Mobile Event App, Real-time Attendance…)
```

with:

```js
// it (Insights, Floor Plan & Booths, Real-time Attendance…)
```

- [ ] **Step 3: Confirm nothing else references the retired screen**

Run: `grep -rn "MobileAppScreen\|Mobile Event App\|conference/mobile_app" components lib app --include=*.js --include=*.jsx`
Expected: no output.

- [ ] **Step 4: Lint**

Run: `npx eslint components/internal/screens/branded/branded_app.jsx components/internal/screens/conference/screens.jsx components/internal/screens/conference/modules/index.js components/internal/screens/registry.jsx components/internal/sidebar/sidebar_nav.jsx components/landing/playground_screen_host.jsx`
Expected: no errors.

If `react-hooks/refs` or a React Compiler rule flags the `configRef` reads inside `update`/`toggleShortcut`, keep the refs. They are event-handler reads, not render reads. Silence that single line with an `eslint-disable-next-line <rule>` and a one-line reason, as `mobile/src/state/data.tsx` does.

---

### Task 5: Portal endpoint `GET /api/portal/app-config`

**Files:**
- Create: `app/api/portal/app-config/route.js`
- Test: `lib/portal/app_config_route.test.js`

**Interfaces:**
- Consumes: `getSessionMember()` (`lib/portal/session.js`), `listMemberProjectIds(email)` (`lib/portal/memberships.js`), `adminClient()` (`lib/supabase/admin.js`, `events` schema), and `mergeForMember` (Task 1).
- Produces: `GET /api/portal/app-config`.
  - Returns `200 { sections: Record<SectionKey, boolean>, home: { welcome: string, liveStrip: boolean, recentOrders: boolean, shortcuts: string[] } }`.
  - Returns `401 { error }` with no session.

- [ ] **Step 1: Write the failing test**

Create `lib/portal/app_config_route.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const root = new URL("../../", import.meta.url);
const mocks = {
  "@/lib/portal/session": "export const getSessionMember=async()=>globalThis.__appConfigFixture.member;",
  "@/lib/portal/memberships": "export const listMemberProjectIds=async()=>globalThis.__appConfigFixture.projectIds;",
  "@/lib/supabase/admin": "export const adminClient=()=>globalThis.__appConfigFixture.db;",
};
registerHooks({
  resolve(specifier, context, next) {
    if (Object.hasOwn(mocks, specifier)) {
      return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) return next(new URL(`${specifier.slice(2)}.js`, root).href, context);
    return next(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});
const { GET } = await import("../../app/api/portal/app-config/route.js");

function fakeDb(rows, error = null) {
  return {
    from(table) {
      assert.equal(table, "app_configs");
      return {
        select() {
          return this;
        },
        in: async (column, ids) => {
          assert.equal(column, "project_id");
          return { data: error ? null : rows.filter((r) => ids.includes(r.project_id)), error };
        },
      };
    },
  };
}

function fixture(t, value) {
  globalThis.__appConfigFixture = value;
  t.after(() => delete globalThis.__appConfigFixture);
}

test("401 without a portal session", async (t) => {
  fixture(t, { member: null, projectIds: [], db: fakeDb([]) });
  const res = await GET();
  assert.equal(res.status, 401);
});

test("a member with no projects gets everything on", async (t) => {
  fixture(t, { member: { id: "m1", email: "a@b.test" }, projectIds: [], db: fakeDb([]) });
  const body = await (await GET()).json();
  assert.equal(body.sections.networking, true);
  assert.deepEqual(body.home.shortcuts, ["community", "watch", "memberships"]);
  assert.equal("whiteLabel" in body, false);
});

test("a single project's config is served as-is", async (t) => {
  fixture(t, {
    member: { id: "m1", email: "a@b.test" },
    projectIds: ["p1"],
    db: fakeDb([{ project_id: "p1", config: { sections: { networking: false }, home: { welcome: "Hi", shortcuts: ["qa"] } } }]),
  });
  const body = await (await GET()).json();
  assert.equal(body.sections.networking, false);
  assert.equal(body.home.welcome, "Hi");
  assert.deepEqual(body.home.shortcuts, ["qa"]);
});

test("a second project without a row turns sections back on", async (t) => {
  fixture(t, {
    member: { id: "m1", email: "a@b.test" },
    projectIds: ["p1", "p2"],
    db: fakeDb([{ project_id: "p1", config: { sections: { networking: false }, home: { welcome: "Hi" } } }]),
  });
  const body = await (await GET()).json();
  assert.equal(body.sections.networking, true);
  assert.equal(body.home.welcome, "");
});

test("a failed read falls back to the defaults instead of hiding sections", async (t) => {
  fixture(t, { member: { id: "m1", email: "a@b.test" }, projectIds: ["p1"], db: fakeDb([], { message: "boom" }) });
  const res = await GET();
  assert.equal(res.status, 200);
  assert.equal((await res.json()).sections.watch, true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/portal/app_config_route.test.js`
Expected: FAIL with `Cannot find module` … `app/api/portal/app-config/route.js`.

- [ ] **Step 3: Write the route**

Create `app/api/portal/app-config/route.js`:

```js
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberProjectIds } from "@/lib/portal/memberships";
import { mergeForMember } from "@/lib/app_config/model";

// The shared app's sections + home, merged across every project the member holds tickets or memberships with.
export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const projectIds = await listMemberProjectIds(member.email);
  const configured = new Map();
  const sb = adminClient();
  if (sb && projectIds.length) {
    const { data, error } = await sb
      .from("app_configs")
      .select("project_id, config")
      .in("project_id", projectIds);
    // A failed read leaves every project on defaults, so nothing disappears from the app by accident.
    if (error) console.error("[portal.app-config]", error.message);
    for (const row of data || []) configured.set(row.project_id, row.config);
  }

  return NextResponse.json(mergeForMember(projectIds.map((id) => configured.get(id) ?? null)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test lib/portal/app_config_route.test.js lib/app_config/model.test.js`
Expected: PASS, 15 tests, 0 failures.

- [ ] **Step 5: Lint**

Run: `npx eslint app/api/portal/app-config lib/portal/app_config_route.test.js`
Expected: no errors.

---

### Task 6: Mobile config provider

**Files:**
- Modify: `mobile/src/types/portal.ts` (append types)
- Create: `mobile/src/state/app_config.tsx`
- Modify: `mobile/src/app/_layout.tsx` (provider order)

**Interfaces:**
- Consumes: `GET /api/portal/app-config` (Task 5); `api` from `@/lib/api`; `useSession` from `@/state/session`.
- Produces:
  - `type AppSection`
  - `type AppConfig`
  - `AppConfigProvider`
  - `useAppConfig(): AppConfig & { isOn(section: AppSection): boolean; refreshAppConfig(): Promise<void> }`
  - `DEFAULT_APP_CONFIG`

- [ ] **Step 1: Add the types**

Append to `mobile/src/types/portal.ts`:

```ts
export type AppSection =
  | "memberships"
  | "live"
  | "watch"
  | "orders"
  | "community"
  | "qa"
  | "messages"
  | "notifications"
  | "agenda"
  | "speakers"
  | "sponsors"
  | "map"
  | "networking"
  | "discussions";

export type AppConfig = {
  sections: Record<AppSection, boolean>;
  home: {
    welcome: string;
    liveStrip: boolean;
    recentOrders: boolean;
    shortcuts: AppSection[];
  };
};
```

- [ ] **Step 2: Write the provider**

Create `mobile/src/state/app_config.tsx`:

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import type { AppConfig, AppSection } from "@/types/portal";

// Until the server answers (or when it can't), the app shows everything — the behaviour before configs existed.
export const DEFAULT_APP_CONFIG: AppConfig = {
  sections: {
    memberships: true,
    live: true,
    watch: true,
    orders: true,
    community: true,
    qa: true,
    messages: true,
    notifications: true,
    agenda: true,
    speakers: true,
    sponsors: true,
    map: true,
    networking: true,
    discussions: true,
  },
  home: {
    welcome: "",
    liveStrip: true,
    recentOrders: true,
    shortcuts: ["community", "watch", "memberships"],
  },
};

type AppConfigState = AppConfig & {
  isOn: (section: AppSection) => boolean;
  refreshAppConfig: () => Promise<void>;
};

const AppConfigContext = createContext<AppConfigState | null>(null);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const { token, status } = useSession();
  // Keyed by token so a different member never sees the previous member's config.
  const [loaded, setLoaded] = useState<{ token: string; config: AppConfig } | null>(null);

  const refreshAppConfig = useCallback(async () => {
    if (!token) return;
    const res = await api<AppConfig>("/api/portal/app-config", { token });
    if (res.ok) setLoaded({ token, config: res.data });
  }, [token]);

  useEffect(() => {
    if (status === "authed") void refreshAppConfig();
  }, [status, refreshAppConfig]);

  // Organisers change sections from the dashboard; pick that up when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refreshAppConfig();
    });
    return () => sub.remove();
  }, [refreshAppConfig]);

  const config =
    status === "authed" && loaded && loaded.token === token ? loaded.config : DEFAULT_APP_CONFIG;

  const isOn = useCallback((section: AppSection) => config.sections[section] !== false, [config]);

  const value = useMemo(
    () => ({ ...config, isOn, refreshAppConfig }),
    [config, isOn, refreshAppConfig],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigState {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppConfig must be used within an AppConfigProvider");
  return ctx;
}
```

- [ ] **Step 3: Mount it between the session and the portal data**

In `mobile/src/app/_layout.tsx`, add the import below the `PortalDataProvider` import:

```tsx
import { AppConfigProvider } from "@/state/app_config";
```

Then replace:

```tsx
          <SessionProvider>
            <PortalDataProvider>
              <LivePlayerProvider>
                <RootNavigator />
              </LivePlayerProvider>
            </PortalDataProvider>
          </SessionProvider>
```

with:

```tsx
          <SessionProvider>
            <AppConfigProvider>
              <PortalDataProvider>
                <LivePlayerProvider>
                  <RootNavigator />
                </LivePlayerProvider>
              </PortalDataProvider>
            </AppConfigProvider>
          </SessionProvider>
```

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0, no output.

---

### Task 7: The app obeys the config

**Files:**
- Modify: `mobile/src/components/TabBar.tsx:35-44`
- Replace: `mobile/src/app/(app)/more/index.tsx` (full rewrite)
- Modify: `mobile/src/app/(app)/home/index.tsx` (imports, live strip, shortcuts, recent orders, welcome card)
- Modify: `mobile/src/app/(app)/inbox/index.tsx` (sources, filter chips, compose button)
- Modify: `mobile/src/state/data.tsx:213-230` (unread counts)

**Interfaces:**
- Consumes: `useAppConfig()` (Task 6).

- [ ] **Step 1: Tab bar hides Memberships when it is off**

In `mobile/src/components/TabBar.tsx`, add the import after `import { usePortalData } from "@/state/data";`:

```tsx
import { useAppConfig } from "@/state/app_config";
```

Replace:

```tsx
  const { counts } = usePortalData();

  type TabEntry = { tab: (typeof TAB_ORDER)[number]; route: (typeof state.routes)[number] };
  const visible = TAB_ORDER.map((tab) => {
```

with:

```tsx
  const { counts } = usePortalData();
  const { isOn } = useAppConfig();

  type TabEntry = { tab: (typeof TAB_ORDER)[number]; route: (typeof state.routes)[number] };
  // Home, Tickets, Inbox and More are the app's frame; only Memberships is a section an organiser can switch off.
  const visible = TAB_ORDER.filter((tab) => tab !== "memberships" || isOn("memberships")).map((tab) => {
```

- [ ] **Step 2: More shows only enabled sections**

Replace the whole contents of `mobile/src/app/(app)/more/index.tsx` with:

```tsx
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { firstName } from "@/lib/format";
import { useAppConfig } from "@/state/app_config";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";

type MoreRow = { key: string; icon: IconName; title: string; trailing?: React.ReactNode; href: Href };

const when = (on: boolean, row: MoreRow): MoreRow[] => (on ? [row] : []);

export default function MoreScreen() {
  const router = useRouter();
  const { counts, data } = usePortalData();
  const { isOn } = useAppConfig();
  const { member, signOut, pushStatus, setPushEnabled } = useSession();
  const { success, error } = useToast();
  const [confirmOut, setConfirmOut] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const activePlan = (data?.memberships || []).find((m) => m.status === "Active");
  const pushOn = pushStatus === "on";

  const togglePush = async (next: boolean) => {
    setPushBusy(true);
    const ok = await setPushEnabled(next);
    setPushBusy(false);
    if (!ok) {
      error("This device can't register for push notifications.");
      return;
    }
    success(next ? "Push notifications on." : "Push notifications off.");
  };

  const library: MoreRow[] = [
    ...when(isOn("memberships"), {
      key: "memberships",
      icon: "award",
      title: "Memberships",
      trailing: activePlan ? <Trailing label={activePlan.planName} /> : null,
      href: "/memberships",
    }),
    ...when(isOn("orders"), {
      key: "orders",
      icon: "shopping-bag",
      title: "Orders & receipts",
      trailing: counts.orders ? <Trailing label={String(counts.orders)} /> : null,
      href: "/orders",
    }),
    ...when(isOn("watch"), {
      key: "watch",
      icon: "circle-play",
      title: "Watch library",
      trailing: counts.watch ? <Trailing label={String(counts.watch)} /> : null,
      href: "/watch",
    }),
    ...when(isOn("qa"), { key: "qa", icon: "circle-question-mark", title: "Q&A threads", href: "/qa" }),
  ];

  const conversations: MoreRow[] = [
    ...when(isOn("community"), {
      key: "community",
      icon: "message-circle",
      title: "Group chats",
      trailing: counts.chats ? <Badge value={counts.chats} /> : null,
      href: "/community",
    }),
    ...when(isOn("messages"), {
      key: "messages",
      icon: "mail",
      title: "Organiser messages",
      trailing: counts.messages ? <Badge value={counts.messages} /> : null,
      href: "/messages",
    }),
    ...when(isOn("notifications"), {
      key: "notifications",
      icon: "bell",
      title: "Updates",
      trailing: counts.notifications ? <Badge value={counts.notifications} /> : null,
      href: "/notifications",
    }),
  ];

  return (
    <Screen scroll>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open account"
        onPress={() => router.push("/account")}
        style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
      >
        <Avatar name={member?.name} email={member?.email} size={60} />
        <View style={styles.profileStack}>
          <Text style={styles.profileName} numberOfLines={1}>
            {member?.name || firstName(member?.name, member?.email)}
          </Text>
          <Text style={styles.profileEmail} numberOfLines={1}>
            {member?.email}
          </Text>
        </View>
        <Icon name="chevron-right" size={19} color={colors.textTertiary} />
      </Pressable>

      <RowGroup rows={library} onGo={(href) => router.push(href)} />
      <RowGroup rows={conversations} onGo={(href) => router.push(href)} />

      <View style={styles.group}>
        <ListRow
          leading={<IconTile icon={pushOn ? "bell" : "bell-off"} size={34} />}
          title="Push notifications"
          subtitle={
            pushStatus === "unsupported"
              ? "Not available on this device or build"
              : "Gate changes, refunds and going-live alerts"
          }
          trailing={
            <Switch
              value={pushOn}
              onValueChange={(next) => void togglePush(next)}
              label="Push notifications"
              disabled={pushBusy || pushStatus === "unsupported"}
            />
          }
          divider={false}
        />
      </View>

      <View style={styles.group}>
        <ListRow
          leading={<IconTile icon="shield" size={34} />}
          title="Password & sessions"
          onPress={() => router.push("/account/change-password")}
        />
        <ListRow
          leading={<IconTile icon="log-out" size={34} tone="danger" />}
          title="Sign out"
          onPress={() => setConfirmOut(true)}
          chevron={false}
          divider={false}
        />
      </View>

      <Sheet visible={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>You&apos;ll need to sign in again to get back in.</Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirmOut(false)} />
            <Button
              title="Sign out"
              variant="destructive"
              onPress={() => {
                setConfirmOut(false);
                void signOut();
              }}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

// An organiser can switch every row of a group off, so an empty group renders nothing.
function RowGroup({ rows, onGo }: { rows: MoreRow[]; onGo: (href: Href) => void }) {
  if (!rows.length) return null;
  return (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <ListRow
          key={row.key}
          leading={<IconTile icon={row.icon} size={34} />}
          title={row.title}
          trailing={row.trailing}
          onPress={() => onGo(row.href)}
          divider={i < rows.length - 1}
        />
      ))}
    </View>
  );
}

function Trailing({ label }: { label: string }) {
  return (
    <Text style={styles.trailing} numberOfLines={1}>
      {label}
    </Text>
  );
}

function Badge({ value }: { value: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{value > 99 ? "99+" : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: spacing.md + 2,
    paddingBottom: 22,
  },
  pressed: {
    opacity: 0.7,
  },
  profileStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  profileName: {
    ...type.title,
    fontSize: 18,
    lineHeight: 22,
    color: colors.foreground,
  },
  profileEmail: {
    ...type.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  trailing: {
    ...type.caption,
    fontSize: 13,
    maxWidth: 140,
    color: colors.textSecondary,
  },
  badge: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
  },
  badgeText: {
    ...type.micro,
    fontSize: 11,
    lineHeight: 14,
    color: colors.primaryForeground,
    fontVariant: ["tabular-nums"],
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetText: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
```

- [ ] **Step 3: Home — imports and config**

In `mobile/src/app/(app)/home/index.tsx`:

- Add `import { Card } from "@/components/ui/Card";` after the `Button` import.
- Add `import { useAppConfig } from "@/state/app_config";` before `import { usePortalData } from "@/state/data";`.
- Replace `import type { Entitlement, LiveRoom, Ticket } from "@/types/portal";` with:
  ```tsx
  import type { AppSection, Entitlement, LiveRoom, Ticket } from "@/types/portal";
  ```

Replace:

```tsx
  const { data, live, channels, counts } = usePortalData();
```

with:

```tsx
  const { data, live, channels, counts } = usePortalData();
  const { home, isOn } = useAppConfig();
```

- [ ] **Step 4: Home — welcome card, live strip, shortcuts, recent orders**

Replace:

```tsx
        <Animated.View layout={LinearTransition} style={styles.stack}>
          {nextTicket ? (
```

with:

```tsx
        <Animated.View layout={LinearTransition} style={styles.stack}>
          {home.welcome ? (
            <Card tone="subtle">
              <Text style={styles.welcome}>{home.welcome}</Text>
            </Card>
          ) : null}

          {nextTicket ? (
```

Replace:

```tsx
          {liveRoom ? (
```

with:

```tsx
          {liveRoom && home.liveStrip && isOn("live") ? (
```

Replace:

```tsx
          <Animated.View entering={FadeInDown.delay(stagger(3)).springify()}>
            <Shortcuts
              chats={chatCount}
              chatsUnread={chatUnread}
              watch={counts.watch || 0}
              plan={activePlan?.planName || null}
              onGo={(href) => router.push(href as Href)}
            />
          </Animated.View>
```

with:

```tsx
          {home.shortcuts.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(3)).springify()}>
              <Shortcuts
                keys={home.shortcuts}
                counts={{
                  chats: chatCount,
                  chatsUnread: chatUnread,
                  watch: counts.watch || 0,
                  plan: activePlan?.planName || null,
                  liveNow: counts.liveNow || 0,
                  orders: counts.orders || 0,
                }}
                onGo={(href) => router.push(href)}
              />
            </Animated.View>
          ) : null}
```

Replace:

```tsx
          {recentOrders.length ? (
```

with:

```tsx
          {recentOrders.length > 0 && home.recentOrders && isOn("orders") ? (
```

(`> 0` matters: a bare `0 &&` would render the number `0` outside a `<Text>`, and React Native throws on that.)

- [ ] **Step 5: Home — config-driven Shortcuts**

Replace the `Shortcut` type and the whole `Shortcuts` function, from `type Shortcut = {` through the closing `}` of `function Shortcuts`, with:

```tsx
type ShortcutCounts = {
  chats: number;
  chatsUnread: number;
  watch: number;
  plan: string | null;
  liveNow: number;
  orders: number;
};

type ShortcutMeta = {
  href: Href;
  icon: IconName;
  label: string;
  value: (c: ShortcutCounts) => string;
};

// Sections an organiser can pin to Home; keys match SHORTCUT_KEYS in lib/app_config/model.js.
const SHORTCUTS: Partial<Record<AppSection, ShortcutMeta>> = {
  community: {
    href: "/community",
    icon: "message-circle",
    label: "Group chat",
    value: (c) =>
      c.chatsUnread
        ? `${c.chatsUnread} unread`
        : c.chats
          ? `${c.chats} ${pluralize(c.chats, "chat", "chats")}`
          : "No chats yet",
  },
  watch: {
    href: "/watch",
    icon: "circle-play",
    label: "Watch",
    value: (c) => (c.watch ? `${c.watch} ${pluralize(c.watch, "video", "videos")}` : "Nothing yet"),
  },
  memberships: {
    href: "/memberships",
    icon: "award",
    label: "Membership",
    value: (c) => c.plan || "Not a member",
  },
  live: {
    href: "/live",
    icon: "radio",
    label: "Live",
    value: (c) => (c.liveNow ? `${c.liveNow} live now` : "Nothing live"),
  },
  orders: {
    href: "/orders",
    icon: "shopping-bag",
    label: "Orders",
    value: (c) => (c.orders ? `${c.orders} ${pluralize(c.orders, "order", "orders")}` : "No orders yet"),
  },
  qa: {
    href: "/qa",
    icon: "circle-question-mark",
    label: "Q&A",
    value: () => "Ask the organisers",
  },
};

// The design brief calls Home "next event, live, shortcuts" — this is the third, chosen per project in Branded App.
function Shortcuts({
  keys,
  counts,
  onGo,
}: {
  keys: AppSection[];
  counts: ShortcutCounts;
  onGo: (href: Href) => void;
}) {
  const items = keys.flatMap((key) => {
    const meta = SHORTCUTS[key];
    return meta ? [{ key, ...meta, valueText: meta.value(counts) }] : [];
  });
  if (!items.length) return null;

  return (
    <View>
      <SectionTitle>Shortcuts</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.shortcutScroll}
        contentContainerStyle={styles.shortcutRow}
      >
        {items.map((s) => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            accessibilityLabel={`${s.label}, ${s.valueText}`}
            onPress={() => onGo(s.href)}
            style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
          >
            <IconTile icon={s.icon} size={34} />
            <View style={styles.shortcutStack}>
              <Text style={styles.shortcutLabel} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={styles.shortcutValue} numberOfLines={1}>
                {s.valueText}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
```

Then add this entry as the first key inside the file's `const styles = StyleSheet.create({`:

```tsx
  welcome: {
    ...type.body,
    color: colors.foreground,
  },
```

- [ ] **Step 6: Inbox hides switched-off sources**

In `mobile/src/app/(app)/inbox/index.tsx`, add `import { useAppConfig } from "@/state/app_config";` above the `usePortalData` import. Then add this as the first line after `const [filter, setFilter] = useState<"all" | Source>("all");`:

```tsx
  const { isOn } = useAppConfig();
```

Inside the `items` `useMemo`, make five one-line replacements.

1. Replace:
   ```tsx
       const fromThreads: InboxItem[] = (threads || []).map((t) => ({
   ```
   with:
   ```tsx
       const fromThreads: InboxItem[] = (isOn("messages") ? threads || [] : []).map((t) => ({
   ```
2. Replace:
   ```tsx
       const fromNotifications: InboxItem[] = (notifications.items || []).map((n) => ({
   ```
   with:
   ```tsx
       const fromNotifications: InboxItem[] = (isOn("notifications") ? notifications.items || [] : []).map((n) => ({
   ```
3. Replace:
   ```tsx
         ...(channels || []).map((c) => ({ c, base: "/community" })),
   ```
   with:
   ```tsx
         ...(isOn("community") ? channels || [] : []).map((c) => ({ c, base: "/community" })),
   ```
4. Replace:
   ```tsx
         ...(qaChannels || []).map((c) => ({ c, base: "/qa" })),
   ```
   with:
   ```tsx
         ...(isOn("qa") ? qaChannels || [] : []).map((c) => ({ c, base: "/qa" })),
   ```
5. Replace:
   ```tsx
     }, [data, threads, notifications, channels, qaChannels]);
   ```
   with:
   ```tsx
     }, [data, threads, notifications, channels, qaChannels, isOn]);
   ```

Replace the `FilterChips` `options` array:

```tsx
          options={[
            { value: "all", label: "All", count: counts.inbox },
            { value: "organiser", label: "Organiser", count: counts.messages },
            { value: "updates", label: "Updates", count: counts.notifications },
            { value: "chats", label: "Chats", count: counts.chats },
          ]}
```

with:

```tsx
          options={[
            { value: "all", label: "All", count: counts.inbox },
            ...(isOn("messages") ? [{ value: "organiser", label: "Organiser", count: counts.messages }] : []),
            ...(isOn("notifications")
              ? [{ value: "updates", label: "Updates", count: counts.notifications }]
              : []),
            ...(isOn("community") || isOn("qa") ? [{ value: "chats", label: "Chats", count: counts.chats }] : []),
          ]}
```

Hide the compose button when organiser messages are off. Replace:

```tsx
        right={
          <IconButton
            icon="square-pen"
            label="New message"
            variant="primary"
            iconSize={20}
            onPress={() => router.push("/messages/new")}
          />
        }
```

with:

```tsx
        right={
          isOn("messages") ? (
            <IconButton
              icon="square-pen"
              label="New message"
              variant="primary"
              iconSize={20}
              onPress={() => router.push("/messages/new")}
            />
          ) : undefined
        }
```

- [ ] **Step 7: Unread badges ignore switched-off sources**

In `mobile/src/state/data.tsx`, replace:

```tsx
import { useSession } from "@/state/session";
```

with:

```tsx
import { useAppConfig } from "@/state/app_config";
import { useSession } from "@/state/session";
```

Then replace:

```tsx
  const { status, token, member } = useSession();
```

with:

```tsx
  const { status, token, member } = useSession();
  const { isOn } = useAppConfig();
```

Replace the body of the `counts` memo:

```tsx
  const counts = useMemo<Counts>(() => {
    const unreadThreads = (threads || []).filter((t) => t.unread).length;
    const unreadChats = [...(channels || []), ...(qaChannels || [])].reduce(
      (sum, c) => sum + (c.unread || 0),
      0,
    );
    return {
      tickets: data?.tickets?.length || null,
      orders: data?.orders?.length || null,
      memberships: data?.memberships?.length || null,
      watch: watch?.length || null,
      messages: unreadThreads || null,
      notifications: notifications.unread || null,
      chats: unreadChats || null,
      inbox: unreadThreads + notifications.unread + unreadChats || null,
      liveNow: (live || []).filter((r) => r.openNow).length || null,
    };
  }, [data, watch, threads, notifications, live, channels, qaChannels]);
```

with:

```tsx
  const counts = useMemo<Counts>(() => {
    const unreadThreads = isOn("messages") ? (threads || []).filter((t) => t.unread).length : 0;
    const unreadNotes = isOn("notifications") ? notifications.unread : 0;
    const unreadChats = [
      ...(isOn("community") ? channels || [] : []),
      ...(isOn("qa") ? qaChannels || [] : []),
    ].reduce((sum, c) => sum + (c.unread || 0), 0);
    return {
      tickets: data?.tickets?.length || null,
      orders: data?.orders?.length || null,
      memberships: data?.memberships?.length || null,
      watch: watch?.length || null,
      messages: unreadThreads || null,
      notifications: unreadNotes || null,
      chats: unreadChats || null,
      inbox: unreadThreads + unreadNotes + unreadChats || null,
      liveNow: (live || []).filter((r) => r.openNow).length || null,
    };
  }, [data, watch, threads, notifications, live, channels, qaChannels, isOn]);
```

- [ ] **Step 8: Typecheck and lint**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0, no output.

Run (repo root): `npm run lint:mobile`
Expected: no errors. Warnings are acceptable only when they point at lines this task did not touch.

- [ ] **Step 9: Prove the bundle compiles**

Run: `cd mobile && npx expo export --platform android --output-dir ../.tmp-expo-export`, then delete `../.tmp-expo-export`.
Expected: "Exported" with no resolution errors. This is far cheaper than an EAS build.

---

### Task 8: Hand-off

- [ ] **Step 1: Run every Phase 1 test together**

Run: `node --test lib/app_config/model.test.js lib/portal/app_config_route.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 2: Report to the user**

Report:

- **Before testing:** run `! npm run db:push` (if not already done) so `events.app_configs` exists.
- **Dashboard check:**
  1. In Branded App, switch off *Watch* and *Q&A*, then pin *Live* and *Orders* as shortcuts.
  2. Reload the page. The settings stay.
- **Phone check** (dev client pointed at your machine, signed in as a member of only that project):
  1. Background and reopen the app.
  2. More loses Watch library and Q&A threads.
  3. Inbox loses Q&A channels.
  4. Home shows the Live and Orders shortcuts and the welcome message.
- **What was removed:**
  - The Mobile Event App screen and its sidebar entry.
  - The simulated build button.
  - The Sign-in and Push cards, which come back wired up in Phase 6.
  - Asset uploads, which come back in Phase 7.
