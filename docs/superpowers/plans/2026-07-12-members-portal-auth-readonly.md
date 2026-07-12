# Geiger Events Members Portal — Slice 1 (Auth) + Slice 2 (Read-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public `/login` members portal where buyers (auto-created passwordless at checkout) set a password via a one-time emailed link, then log in with email + password to view their orders, tickets, and memberships read-only.

**Architecture:** Custom members store in the `events` schema (separate from Supabase Auth). All sensitive work runs in Next server routes using a **service-role** Supabase client (bypasses the app's org-scoped RLS). Passwords are scrypt-hashed in Node; sessions are opaque httpOnly cookies backed by a `portal_sessions` table; first-password/reset requires a one-time emailed token. Members are auto-created inside the `buy_ticket` RPC so every purchase (free or paid) yields a member row.

**Tech Stack:** Next.js 16 (App Router route handlers), `@supabase/supabase-js` service-role client, Node `crypto` (scrypt/sha256), Postgres (`events` schema), Tailwind + shared kit.

## Global Constraints

- Members store is **custom**, separate from Supabase Auth.
- Service role key is **server-only** (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`). `lib/supabase/admin.js` must never be imported by a client component.
- Passwords **scrypt-hashed in Node**, never stored/transmitted in clear; compare with `crypto.timingSafeEqual`.
- First-password/reset requires a **one-time emailed token** (ownership proof). No set-without-verification path.
- Auth tables (`portal_members`, `portal_sessions`, `portal_password_setups`) have RLS **enabled with no anon/authenticated policy** — service role only.
- Session cookie: `geP_session`, httpOnly + Secure + SameSite=Lax, ~30-day expiry. Setup-token TTL ~1 hour.
- Reads are scoped to the **session member's email**, never a client-supplied email.
- SQL is idempotent; run via `npm run db:push`. The authoritative `buy_ticket` is in `supabase/sqls/zz_project_access.sql`.
- Semantic color tokens only; reuse shared kit + shadcn. `npx eslint <files>` clean per task.
- Do NOT run a build unless verifying a significant UI regression.

---

### Task 1: SQL — portal tables + member auto-create in `buy_ticket`

**Files:**
- Create: `supabase/sqls/portal_members.sql`
- Modify: `supabase/sqls/zz_project_access.sql` (the `buy_ticket` function body + a grant-adjacent block)

**Interfaces:**
- Produces: tables `events.portal_members` (unique on `lower(email)`),
  `events.portal_sessions`, `events.portal_password_setups`; every purchase
  upserts a passwordless `portal_members` row.

- [ ] **Step 1: Create the portal tables file**

Create `supabase/sqls/portal_members.sql`:

```sql
-- ===========================================================================
-- Geiger Events — members portal (custom auth store)
--
-- Self-contained + idempotent. A "member" is a buyer account, distinct from any
-- Supabase Auth user. Rows are auto-created passwordless by events.buy_ticket
-- (see zz_project_access.sql). Passwords are scrypt-hashed in the app (Node) and
-- stored here; sessions + one-time setup tokens live in their own tables.
--
-- RLS is ENABLED with NO policy: only the service role (which bypasses RLS)
-- touches these tables, exclusively from server routes. Runs before
-- zz_project_access.sql (buy_ticket references portal_members); defines
-- touch_updated_at() locally.
-- ===========================================================================

create schema if not exists events;
create extension if not exists pgcrypto;

create or replace function events.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists events.portal_members (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  name           text not null default '',
  password_hash  text,
  password_set_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  metadata       jsonb not null default '{}'::jsonb
);

-- Case-insensitive unique email (also the ON CONFLICT target in buy_ticket).
create unique index if not exists portal_members_email_key
  on events.portal_members (lower(email));

drop trigger if exists portal_members_touch_updated_at on events.portal_members;
create trigger portal_members_touch_updated_at
before update on events.portal_members
for each row execute function events.touch_updated_at();

create table if not exists events.portal_sessions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references events.portal_members(id) on delete cascade,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists portal_sessions_member_idx on events.portal_sessions (member_id);

create table if not exists events.portal_password_setups (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references events.portal_members(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists portal_password_setups_member_idx on events.portal_password_setups (member_id);

-- RLS on, no policy: service-role-only access.
alter table events.portal_members          enable row level security;
alter table events.portal_sessions         enable row level security;
alter table events.portal_password_setups  enable row level security;
```

- [ ] **Step 2: Add the member upsert inside `buy_ticket`**

In `supabase/sqls/zz_project_access.sql`, inside the `create or replace function
events.buy_ticket(...)` body, immediately AFTER the `insert into
events.event_orders ... returning id into v_order;` block (before the
`update events.events` block), add:

```sql
  -- Auto-create a passwordless members-portal account for the buyer (both free
  -- and paid paths funnel here). Skips empty emails; never overwrites a set name.
  if coalesce(p_email, '') <> '' then
    insert into events.portal_members (email, name)
    values (lower(p_email), coalesce(p_name, ''))
    on conflict (lower(email)) do update
      set name = case when events.portal_members.name = ''
                      then excluded.name else events.portal_members.name end;
  end if;
```

- [ ] **Step 3: Verify `portal_members.sql` runs before `zz_`**

`scripts/run-sqls.js` runs files in filename order; `portal_members.sql` sorts
before `zz_project_access.sql`, so the table exists when `buy_ticket` is
(re)created. Confirm by reading the filenames — no code change needed.

- [ ] **Step 4: (User) apply the migration**

Run: `npm run db:push`
Expected: completes without error; `events.portal_members`, `portal_sessions`,
`portal_password_setups` exist.

---

### Task 2: Service-role admin client

**Files:**
- Create: `lib/supabase/admin.js`

**Interfaces:**
- Produces: `adminClient()` → service-role `SupabaseClient` scoped to schema
  `events`, or `null` when `SUPABASE_SERVICE_ROLE_KEY` is missing.
  `isAdminConfigured()` → boolean.

- [ ] **Step 1: Write the admin client**

Create `lib/supabase/admin.js`:

```js
import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SERVICE ROLE key — bypasses RLS so the
// members portal can read org-scoped rows (orders/memberships) and the custom
// auth tables. NEVER import this from a client component; the key is not public.

export function isAdminConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function adminClient() {
  if (!isAdminConfigured()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: "events" },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint lib/supabase/admin.js`
Expected: clean. (If `server-only` isn't installed, drop the import — Next 16
bundles it; confirm with `npx eslint` and remove the line if it errors.)

---

### Task 3: Session + crypto helpers

**Files:**
- Create: `lib/portal/session.js`

**Interfaces:**
- Consumes: `adminClient()` (Task 2).
- Produces (all server-only):
  - `hashPassword(plain)` → `string` (scrypt encoded)
  - `verifyPassword(plain, encoded)` → `boolean`
  - `randomToken()` → `{ token, tokenHash }` (raw + sha256 hex)
  - `sha256(value)` → hex string
  - `SESSION_COOKIE` = `"geP_session"`
  - `sessionCookieOptions(maxAgeSeconds)` → cookie options object
  - `getSessionMember()` → `{ id, email, name } | null` (reads the cookie)

- [ ] **Step 1: Write the helpers**

Create `lib/portal/session.js`:

```js
import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";

export const SESSION_COOKIE = "geP_session";
const SCRYPT_KEYLEN = 64;

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

// scrypt with a random 16-byte salt, encoded as scrypt$<saltHex>$<hashHex>.
export function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain, encoded) {
  if (typeof encoded !== "string") return false;
  const [scheme, saltHex, hashHex] = encoded.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(
    String(plain),
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual);
}

// Opaque token for cookies/links; store only its sha256.
export function randomToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}

export function sessionCookieOptions(maxAgeSeconds) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

// Resolve the current member from the session cookie. Returns null if no/invalid
// cookie, expired session, or admin client unavailable.
export async function getSessionMember() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const sb = adminClient();
  if (!sb) return null;
  const { data: session, error } = await sb
    .from("portal_sessions")
    .select("member_id, expires_at")
    .eq("token_hash", sha256(raw))
    .maybeSingle();
  if (error || !session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  const { data: member } = await sb
    .from("portal_members")
    .select("id, email, name")
    .eq("id", session.member_id)
    .maybeSingle();
  return member ? { id: member.id, email: member.email, name: member.name } : null;
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint lib/portal/session.js`
Expected: clean.

---

### Task 4: Auth API routes

**Files:**
- Create: `app/api/portal/lookup/route.js`
- Create: `app/api/portal/request-setup/route.js`
- Create: `app/api/portal/set-password/route.js`
- Create: `app/api/portal/login/route.js`
- Create: `app/api/portal/logout/route.js`
- Create: `app/api/portal/me/route.js`

**Interfaces:**
- Consumes: `adminClient`, session helpers (Tasks 2–3), `sendSuiteEmail`.
- Produces: the JSON contracts the UI (Task 6) calls.

- [ ] **Step 1: `lookup` — email-first branch**

Create `app/api/portal/lookup/route.js`:

```js
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

// { email } -> { exists, hasPassword }. Drives the email-first login UI.
export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ exists: false, hasPassword: false });
  const { data } = await sb
    .from("portal_members")
    .select("id, password_hash")
    .eq("email", clean)
    .maybeSingle();
  return NextResponse.json({
    exists: Boolean(data),
    hasPassword: Boolean(data?.password_hash),
  });
}
```

- [ ] **Step 2: `request-setup` — email a one-time set/reset link**

Create `app/api/portal/request-setup/route.js`:

```js
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { randomToken } from "@/lib/portal/session";
import { sendSuiteEmail } from "@/lib/email/client";

// { email, origin, basePath } -> always { ok:true } (never reveals existence).
// When the member exists, mint a one-time setup token and email the link.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const clean = String(body.email || "").trim().toLowerCase();
  const generic = NextResponse.json({ ok: true });
  if (!clean || !clean.includes("@")) return generic;

  const sb = adminClient();
  if (!sb) return generic;
  const { data: member } = await sb
    .from("portal_members")
    .select("id, name")
    .eq("email", clean)
    .maybeSingle();
  if (!member) return generic;

  const { token, tokenHash } = randomToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
  const { error } = await sb
    .from("portal_password_setups")
    .insert({ member_id: member.id, token_hash: tokenHash, expires_at: expires });
  if (error) {
    console.error("[portal.request-setup]", error.message);
    return generic;
  }

  let base = "";
  try {
    if (body.origin && /^https?:\/\//i.test(body.origin)) {
      base = new URL(body.origin).origin;
    }
  } catch {
    base = "";
  }
  const setupUrl = `${base}${body.basePath || ""}/login?setup=${token}`;
  await sendSuiteEmail({
    template: "events.portal_set_password",
    to: clean,
    subject: "Set your Geiger Events password",
    data: { name: member.name || "there", setupUrl },
  });
  return generic;
}
```

- [ ] **Step 3: `set-password` — consume token, set password, start session**

Create `app/api/portal/set-password/route.js`:

```js
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  SESSION_COOKIE,
  hashPassword,
  randomToken,
  sha256,
  sessionCookieOptions,
} from "@/lib/portal/session";

const SESSION_DAYS = 30;

// { token, password } -> sets password, creates a session, sets cookie.
export async function POST(request) {
  const { token, password } = await request.json().catch(() => ({}));
  if (!token || !password || String(password).length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const { data: setup } = await sb
    .from("portal_password_setups")
    .select("id, member_id, expires_at, used_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!setup || setup.used_at || new Date(setup.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This link is invalid or expired." }, { status: 400 });
  }

  await sb
    .from("portal_members")
    .update({ password_hash: hashPassword(password), password_set_at: new Date().toISOString() })
    .eq("id", setup.member_id);
  await sb.from("portal_password_setups").update({ used_at: new Date().toISOString() }).eq("id", setup.id);

  const { token: sessionToken, tokenHash } = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await sb.from("portal_sessions").insert({ member_id: setup.member_id, token_hash: tokenHash, expires_at: expires });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(SESSION_DAYS * 86400));
  return res;
}
```

- [ ] **Step 4: `login` — verify password, start session**

Create `app/api/portal/login/route.js`:

```js
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  SESSION_COOKIE,
  verifyPassword,
  randomToken,
  sessionCookieOptions,
} from "@/lib/portal/session";

const SESSION_DAYS = 30;

// { email, password } -> verifies, creates a session, sets cookie.
export async function POST(request) {
  const { email, password } = await request.json().catch(() => ({}));
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  const sb = adminClient();
  if (!sb) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const { data: member } = await sb
    .from("portal_members")
    .select("id, password_hash")
    .eq("email", clean)
    .maybeSingle();
  if (!member || !member.password_hash || !verifyPassword(password, member.password_hash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const { token, tokenHash } = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await sb.from("portal_sessions").insert({ member_id: member.id, token_hash: tokenHash, expires_at: expires });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_DAYS * 86400));
  return res;
}
```

- [ ] **Step 5: `logout`**

Create `app/api/portal/logout/route.js`:

```js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, sha256 } from "@/lib/portal/session";

export async function POST() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    const sb = adminClient();
    if (sb) await sb.from("portal_sessions").delete().eq("token_hash", sha256(raw));
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
```

- [ ] **Step 6: `me`**

Create `app/api/portal/me/route.js`:

```js
import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";

export async function GET() {
  const member = await getSessionMember();
  return NextResponse.json({ member: member || null });
}
```

- [ ] **Step 7: Lint the routes**

Run: `npx eslint app/api/portal/**/route.js`
Expected: clean.

---

### Task 5: Portal reads + data route

**Files:**
- Create: `lib/portal/reads.js`
- Create: `app/api/portal/data/route.js`

**Interfaces:**
- Consumes: `adminClient`, `getSessionMember`.
- Produces: `GET /api/portal/data` → `{ orders, memberships, tickets }` (camelCase),
  or `{ error }` 401 when signed out.

- [ ] **Step 1: Reads keyed by the member's email**

Create `lib/portal/reads.js`:

```js
import "server-only";
import { adminClient } from "@/lib/supabase/admin";

// All reads use the service role (bypasses org-scoped RLS) and are scoped to the
// member's own email. camelCase view models the portal renders directly.

export async function listMemberOrders(email) {
  const sb = adminClient();
  if (!sb || !email) return [];
  const { data, error } = await sb
    .from("event_orders")
    .select("id, event_id, ticket_name, quantity, total, status, created_at, event:events(name, event_date, cover_url)")
    .ilike("buyer_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[portal.orders]", error.message);
    return [];
  }
  return (data || []).map((o) => ({
    id: o.id,
    eventId: o.event_id,
    eventName: o.event?.name ?? "Event",
    eventDate: o.event?.event_date ?? "",
    coverUrl: o.event?.cover_url ?? "",
    ticket: o.ticket_name ?? "",
    quantity: o.quantity ?? 1,
    total: Number(o.total ?? 0),
    status: o.status ?? "confirmed",
    createdAt: o.created_at,
  }));
}

export async function listMemberMemberships(email) {
  const sb = adminClient();
  if (!sb || !email) return [];
  const { data, error } = await sb
    .from("membership_members")
    .select("id, status, started_at, expires_at, plan:ticketing_records(name, config)")
    .ilike("email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[portal.memberships]", error.message);
    return [];
  }
  return (data || []).map((m) => ({
    id: m.id,
    planName: m.plan?.name ?? "Membership",
    price: Number(m.plan?.config?.price ?? 0),
    billingPeriod: m.plan?.config?.billingPeriod ?? "",
    discountPercent: Number(m.plan?.config?.discountPercent ?? 0),
    status: m.status ?? "Active",
    startedAt: m.started_at ?? null,
    expiresAt: m.expires_at ?? null,
  }));
}

// A ticket is a confirmed order; one card per order.
export function ticketsFromOrders(orders) {
  return (orders || [])
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .map((o) => ({
      id: o.id,
      eventName: o.eventName,
      eventDate: o.eventDate,
      ticket: o.ticket,
      quantity: o.quantity,
      status: o.status,
    }));
}
```

- [ ] **Step 2: Data route**

Create `app/api/portal/data/route.js`:

```js
import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberOrders, listMemberMemberships, ticketsFromOrders } from "@/lib/portal/reads";

export async function GET() {
  const member = await getSessionMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const [orders, memberships] = await Promise.all([
    listMemberOrders(member.email),
    listMemberMemberships(member.email),
  ]);
  return NextResponse.json({ orders, memberships, tickets: ticketsFromOrders(orders) });
}
```

- [ ] **Step 3: Lint**

Run: `npx eslint lib/portal/reads.js app/api/portal/data/route.js`
Expected: clean.

---

### Task 6: Portal UI — `/login` page + components

**Files:**
- Create: `app/login/page.js`
- Create: `components/portal/members_portal.jsx`
- Create: `components/portal/auth_flow.jsx`
- Create: `components/portal/portal_shell.jsx`
- Create: `components/portal/portal_lists.jsx` (memberships/orders/tickets renderers)

**Interfaces:**
- Consumes: the JSON routes from Tasks 4–5 via `fetch`.

- [ ] **Step 1: Route page**

Create `app/login/page.js`:

```jsx
import MembersPortal from "@/components/portal/members_portal";

export const metadata = { title: "Members · Geiger Events" };

export default function LoginPage() {
  return <MembersPortal />;
}
```

- [ ] **Step 2: Portal shell/root (auth gate)**

Create `components/portal/members_portal.jsx` — a `"use client"` component that:
- on mount, reads `?setup=` from `window.location`; if present, renders
  `<AuthFlow initialSetupToken={token} />`.
- else calls `GET /api/portal/me`; while loading shows a centered spinner;
  if `member` → `<PortalShell member={member} />`; else `<AuthFlow />`.

```jsx
"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import AuthFlow from "./auth_flow";
import PortalShell from "./portal_shell";

export function MembersPortal() {
  const [state, setState] = useState({ loading: true, member: null, setupToken: null });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupToken = params.get("setup");
    if (setupToken) {
      setState({ loading: false, member: null, setupToken });
      return;
    }
    let alive = true;
    fetch("/api/portal/me")
      .then((r) => r.json())
      .then((d) => alive && setState({ loading: false, member: d.member, setupToken: null }))
      .catch(() => alive && setState({ loading: false, member: null, setupToken: null }));
    return () => { alive = false; };
  }, []);

  if (state.loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-background text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (state.member) return <PortalShell member={state.member} />;
  return <AuthFlow initialSetupToken={state.setupToken} />;
}

export default MembersPortal;
```

- [ ] **Step 3: Auth flow (email-first + set-password + confirm-then-send)**

Create `components/portal/auth_flow.jsx` — a `"use client"` component with a
`step` state machine: `"email"` → `"password"` (has password) |
`"setup-prompt"` (no password; a "Set up your account — we'll email you a link"
card whose confirm button POSTs `/api/portal/request-setup` then shows
`"check-email"`) | `"set-password"` (when `initialSetupToken`, POST
`/api/portal/set-password`, then `window.location.href = "/login"`). Uses
`Input`, `Button`, `Field`, `toast`; semantic tokens; one card centered on
`bg-background`. Full logic:

```jsx
"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/internal/shared/screen_kit";

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function AuthFlow({ initialSetupToken = null }) {
  const [step, setStep] = useState(initialSetupToken ? "set-password" : "email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const submitEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { ok, data } = await postJson("/api/portal/lookup", { email });
    setBusy(false);
    if (!ok) return toast.error(data.error || "Try again.");
    if (data.exists && data.hasPassword) setStep("password");
    else if (data.exists) setStep("setup-prompt");
    else setStep("no-account");
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { ok, data } = await postJson("/api/portal/login", { email, password });
    setBusy(false);
    if (!ok) return toast.error(data.error || "Incorrect email or password.");
    window.location.href = `${basePath}/login`;
  };

  const sendSetup = async () => {
    setBusy(true);
    await postJson("/api/portal/request-setup", { email, origin, basePath });
    setBusy(false);
    setStep("check-email");
  };

  const submitSetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { ok, data } = await postJson("/api/portal/set-password", { token: initialSetupToken, password });
    setBusy(false);
    if (!ok) return toast.error(data.error || "This link is invalid or expired.");
    window.location.href = `${basePath}/login`;
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface-subtle p-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Geiger Events</h1>
          <p className="text-sm text-text-secondary">Your tickets, orders, and memberships.</p>
        </div>

        {step === "email" && (
          <form onSubmit={submitEmail} className="space-y-4">
            <Field label="Email">
              <Input type="email" value={email} autoFocus required
                onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </Field>
            <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </Button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={submitPassword} className="space-y-4">
            <p className="text-sm text-text-secondary">{email}</p>
            <Field label="Password">
              <Input type="password" value={password} autoFocus required
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log in"}
            </Button>
            <button type="button" onClick={sendSetup} className="w-full text-xs text-text-tertiary hover:text-muted-foreground">
              Forgot password?
            </button>
          </form>
        )}

        {step === "setup-prompt" && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Your account <span className="text-foreground">{email}</span> needs a password.
              We'll email you a secure link to set one.
            </p>
            <Button onClick={sendSetup} disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Email me a set-up link"}
            </Button>
          </div>
        )}

        {step === "check-email" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Mail className="h-8 w-8 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              If <span className="text-foreground">{email}</span> has an account, a link is on its way.
              Check your inbox to set your password.
            </p>
          </div>
        )}

        {step === "no-account" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-text-secondary">
              We couldn't find an account for <span className="text-foreground">{email}</span>.
              Buy a ticket to any event and your account is created automatically.
            </p>
            <button type="button" onClick={() => setStep("email")} className="text-xs text-text-tertiary hover:text-muted-foreground">
              Try another email
            </button>
          </div>
        )}

        {step === "set-password" && (
          <form onSubmit={submitSetPassword} className="space-y-4">
            <p className="text-sm text-text-secondary">Choose a password for your account.</p>
            <Field label="New password" hint="At least 8 characters.">
              <Input type="password" value={password} autoFocus required
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set password & sign in"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthFlow;
```

- [ ] **Step 4: Portal shell + lists**

Create `components/portal/portal_lists.jsx` with three pure renderers
(`MembershipsList`, `OrdersList`, `TicketsList`) taking arrays and rendering
cards with `StatusPill`/`EmptyState` from the shared kit, semantic tokens, and a
`currency`/date formatter. Then `components/portal/portal_shell.jsx`:

```jsx
"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MembershipsList, OrdersList, TicketsList } from "./portal_lists";

const TABS = [
  { key: "memberships", label: "Memberships" },
  { key: "orders", label: "Orders" },
  { key: "tickets", label: "Tickets" },
];

export function PortalShell({ member }) {
  const [tab, setTab] = useState("memberships");
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/portal/data")
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ orders: [], memberships: [], tickets: [] }));
    return () => { alive = false; };
  }, []);

  const signOut = async () => {
    await fetch("/api/portal/logout", { method: "POST" }).catch(() => {});
    toast.success("Signed out.");
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`;
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Geiger Events</p>
          <p className="truncate text-xs text-text-secondary">{member.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex gap-1 rounded-lg border border-border bg-surface-card p-0.5">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-surface-hover text-foreground" : "text-text-secondary hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {!data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : tab === "memberships" ? (
          <MembershipsList items={data.memberships} />
        ) : tab === "orders" ? (
          <OrdersList items={data.orders} />
        ) : (
          <TicketsList items={data.tickets} />
        )}
      </div>
    </div>
  );
}

export default PortalShell;
```

For `portal_lists.jsx`, render each list with the shared kit's `EmptyState` and
`StatusPill`; example for orders (mirror for memberships/tickets):

```jsx
"use client";

import React from "react";
import { Ticket, BadgeCheck, ShoppingBag } from "lucide-react";
import { EmptyState, StatusPill } from "@/components/internal/shared/screen_kit";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

const ORDER_STATUS = {
  confirmed: { label: "Confirmed", dotClass: "bg-emerald-400" },
  cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
  refunded: { label: "Refunded", dotClass: "bg-sky-400" },
};
const MEMBER_STATUS = {
  Active: { label: "Active", dotClass: "bg-emerald-400" },
  Expired: { label: "Expired", dotClass: "bg-amber-400" },
  Cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
};

function Card({ children }) {
  return <div className="rounded-xl border border-border bg-surface-card p-4">{children}</div>;
}

export function OrdersList({ items }) {
  if (!items?.length) return <EmptyState icon={ShoppingBag} title="No orders yet" description="Your ticket purchases will show up here." />;
  return (
    <div className="space-y-3">
      {items.map((o) => (
        <Card key={o.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{o.eventName}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{o.ticket} × {o.quantity} · {fmtDate(o.createdAt)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusPill status={o.status} map={ORDER_STATUS} />
              <span className="text-sm tabular-nums text-foreground">{money(o.total)}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TicketsList({ items }) {
  if (!items?.length) return <EmptyState icon={Ticket} title="No tickets yet" description="Tickets from your purchases will appear here." />;
  return (
    <div className="space-y-3">
      {items.map((t) => (
        <Card key={t.id}>
          <p className="text-sm font-semibold text-foreground">{t.eventName}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{t.ticket} × {t.quantity}{t.eventDate ? ` · ${fmtDate(t.eventDate)}` : ""}</p>
        </Card>
      ))}
    </div>
  );
}

export function MembershipsList({ items }) {
  if (!items?.length) return <EmptyState icon={BadgeCheck} title="No memberships" description="Memberships you hold will appear here." />;
  return (
    <div className="space-y-3">
      {items.map((m) => (
        <Card key={m.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{m.planName}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {money(m.price)}{m.billingPeriod && m.billingPeriod !== "one-time" ? `/${m.billingPeriod}` : ""}
                {m.discountPercent ? ` · ${m.discountPercent}% member discount` : ""}
              </p>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {m.startedAt ? `Since ${fmtDate(m.startedAt)}` : ""}{m.expiresAt ? ` · renews ${fmtDate(m.expiresAt)}` : ""}
              </p>
            </div>
            <StatusPill status={m.status} map={MEMBER_STATUS} />
          </div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Lint the UI**

Run: `npx eslint app/login/page.js components/portal/*.jsx`
Expected: clean. Confirm `EmptyState`/`StatusPill`/`Field` signatures against
`components/internal/shared/screen_kit.jsx` and adjust props if they differ.

---

### Task 7: Final sweep + manual verification

- [ ] **Step 1: Lint everything**

Run:
```bash
npx eslint lib/supabase/admin.js lib/portal/session.js lib/portal/reads.js app/api/portal/**/route.js app/login/page.js components/portal/*.jsx
```
Expected: clean.

- [ ] **Step 2: Manual verification checklist (no build required)**

- `POST /api/portal/lookup` returns `{exists,hasPassword}` for a known/unknown email.
- Buying a ticket (free path) inserts a `portal_members` row (check the table).
- `/login`: unknown email → "no account"; existing passwordless → "set up" →
  email link → `/login?setup=<token>` → set password → lands signed-in.
- Returning member: email → password → signed in; refresh stays signed in.
- Signed in: `/api/portal/data` returns only that email's orders/memberships;
  the three tabs render with empty states when appropriate.
- "Forgot password?" and "Sign out" work.

---

## Self-Review

**Spec coverage:**
- Custom members store separate from Supabase Auth — Task 1. ✓
- Auto-create passwordless at checkout via `buy_ticket` — Task 1 Step 2. ✓
- Email-first login; set-password on first login via confirm-then-email link —
  Task 4 (lookup/request-setup/set-password) + Task 6 auth_flow. ✓
- One-time emailed token; no set-without-verification — Task 4 Steps 2–3. ✓
- scrypt hashing in Node, opaque httpOnly session cookie, revocable sessions —
  Task 3 + Task 4. ✓
- Service-role server-side reads (org-scoped RLS reality) — Tasks 2, 5. ✓
- Auth tables RLS-deny (service-role only) — Task 1 Step 1. ✓
- `/login` public route; portal shell with Memberships/Orders/Tickets — Task 6. ✓
- Reads scoped to session member's email — Task 5. ✓
- `SUPABASE_SERVICE_ROLE_KEY` + `npm run db:push` + email template — Task 1 Step 4,
  Task 2, and Global Constraints. ✓

**Placeholder scan:** none — full code in every code step. ✓

**Type/name consistency:** `SESSION_COOKIE`, `sha256`, `randomToken`,
`hashPassword`, `verifyPassword`, `sessionCookieOptions`, `getSessionMember`,
`adminClient`, `isAdminConfigured`, `listMemberOrders`, `listMemberMemberships`,
`ticketsFromOrders` used identically across tasks. Route JSON contracts
(`{exists,hasPassword}`, `{ok}`, `{member}`, `{orders,memberships,tickets}`)
match between Task 4/5 producers and Task 6 consumers. ✓

## Follow-ups (flagged, not in this plan)

- Rate-limit `lookup`/`login`/`request-setup`.
- Slices 3–5: buy/upgrade membership, order cancel/refund/transfer.
- Revisit whether to tighten portal reads to a SECURITY DEFINER RPC if a service
  key is undesirable in some environment.
