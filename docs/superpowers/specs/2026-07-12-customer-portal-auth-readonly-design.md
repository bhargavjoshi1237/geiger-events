# Geiger Events Members Portal — Slice 1 (Auth) + Slice 2 (Read-only)

**Date:** 2026-07-12
**Status:** Awaiting review
**Part of:** Members Portal (5-slice program — see "Program context")
**Revision:** Custom members store (email + password), replacing the earlier
Supabase-Auth/OTP drafts, per user direction.

## Program context (the whole ask, decomposed)

A buyer-facing **Geiger Events members portal**: log in, view/manage orders,
tickets, and memberships; later buy/upgrade memberships and cancel/refund. Five
subsystems, foundation-first:

| # | Slice | Depends on | Status |
|---|-------|-----------|--------|
| **1** | Member identity & custom auth (email + password) | — | **this spec** |
| **2** | Portal shell + read views (orders / tickets / membership) | 1 | **this spec** |
| 3 | Buy membership (Stripe/free → enrollment) | 1, payments | future spec |
| 4 | Upgrade / renew / cancel membership | 3 | future spec |
| 5 | Order/ticket actions — cancel, refund, transfer | 1, payments | future spec |

## The revised auth model (per user)

- **Route `/login`** — publicly reachable (no pre-auth), the members portal.
  Signed-out shows the auth flow; signed-in shows the portal (manage orders,
  tickets, memberships).
- **Members are a custom store, separate from any global Supabase Auth user.**
  We do not use Supabase Auth for these accounts (a Supabase auth user is unique
  per email across the whole shared suite; the user wants event members to be a
  distinct identity).
- **Auto-created at checkout, passwordless.** When someone buys (free or paid)
  and enters their email, a `portal_members` row is created then and there with
  no password.
- **Email-first login.** Member enters email → we check what's on file:
  - **No password set** → send a one-time "set your password" link by email
    (proof of ownership) → they set a password → session starts.
  - **Password set** → ask for the password → `login`.
- Same one-time link powers **forgot password**.

## Current-state facts (grounding)

- Every purchase — free and paid — funnels through the **`events.buy_ticket`
  RPC** (`supabase/sqls/orders.sql`). Paid orders finalize server-side in
  `app/api/checkout/verify/route.js`; free orders call the RPC from the public
  page. This RPC is the single hook for member auto-create.
- An **email pipeline exists**: `sendSuiteEmail({ template, to, data })` from
  `@/lib/email/client`, already used for purchase confirmations and approval
  emails. A new template (`events.portal_set_password`) sends the claim link.
- Browser client is `@supabase/ssr`; DB default schema `events`.
- **RLS reality (important):** the app has migrated to **org-scoped RLS**
  (`zz_project_access.sql`, runs last). `event_orders` and `membership_members`
  are readable only by an authenticated **org member** (`can_access_project`). A
  portal member is NOT a Supabase-auth org member, so **the anon browser client
  cannot read those tables.** Therefore all portal reads + auth-table access run
  **server-side via the Supabase service role** (the routes are the trust
  boundary). The authoritative `buy_ticket` also lives in `zz_project_access.sql`.
- No auth/JWT/bcrypt library is assumed; we use **Node built-ins** (`crypto`
  scrypt + `next/headers` cookies) to avoid new dependencies.

## Design

### New tables (`supabase/sqls/portal_members.sql`, idempotent)

```
events.portal_members
  id             uuid primary key default gen_random_uuid()
  email          text not null                       -- stored lowercased; unique
  name           text not null default ''
  password_hash  text                                -- null until claimed (scrypt)
  password_set_at timestamptz
  created_at     timestamptz not null default now()
  updated_at     timestamptz not null default now()
  metadata       jsonb not null default '{}'::jsonb
  -- unique index on lower(email)

events.portal_sessions              -- opaque login sessions (revocable)
  id           uuid primary key default gen_random_uuid()
  member_id    uuid not null references events.portal_members(id) on delete cascade
  token_hash   text not null unique                  -- sha256 of the cookie token
  created_at   timestamptz not null default now()
  expires_at   timestamptz not null                  -- e.g. now()+30d

events.portal_password_setups       -- one-time set/reset-password tokens
  id           uuid primary key default gen_random_uuid()
  member_id    uuid not null references events.portal_members(id) on delete cascade
  token_hash   text not null unique                  -- sha256 of the emailed token
  expires_at   timestamptz not null                  -- e.g. now()+1h
  used_at      timestamptz
  created_at   timestamptz not null default now()
```

- `updated_at` trigger via shared `events.touch_updated_at()`.
- RLS: **enabled with NO anon/authenticated policy (deny by default)**. Only the
  **service role** (which bypasses RLS) touches these tables, exclusively from
  server API routes. The browser never reads them, so `password_hash`/`token_hash`
  never leave the server.

### Member auto-create at checkout

Extend `events.buy_ticket(...)` (orders.sql) to upsert a passwordless member
inside the same transaction as the order:

```sql
insert into events.portal_members (email, name)
values (lower(coalesce(p_email,'')), coalesce(p_name,''))
on conflict (lower(email)) do update
  set name = case when events.portal_members.name = ''
                  then excluded.name else events.portal_members.name end;
```

Guarded so an empty email is skipped. This guarantees a member row for every
buyer on both the free and paid paths, with no change to the callers.

### Auth server routes (`app/api/portal/*`) — all server-side

Passwords/tokens never leave the server. Hashing: `scrypt` with a per-record
salt (`scrypt$N$salt$hash`), constant-time compare. Session token: 32 random
bytes, base64url; store `sha256(token)`; set an **httpOnly, Secure, SameSite=Lax
cookie** `geP_session`.

- `POST /api/portal/lookup { email }` → `{ exists, hasPassword }`. Drives the
  email-first UI. (Returns `exists:false` plainly — see rate-limit note.)
- `POST /api/portal/login { email, password }` → verify hash → create session +
  set cookie → `{ ok }`; else 401.
- `POST /api/portal/request-setup { email }` → if the member exists, mint a
  one-time setup token, store its hash, `sendSuiteEmail("events.portal_set_password",
  …, { setupUrl })`. **Always returns a generic `{ ok:true }`** so it never
  reveals whether an email is on file. Used for both first-time set and forgot.
- `POST /api/portal/set-password { token, password }` → look up unused, unexpired
  token by hash → set `password_hash` + `password_set_at`, mark token used,
  create session + cookie → `{ ok }`.
- `POST /api/portal/logout` → delete the session row, clear cookie.
- `GET /api/portal/me` → resolve the session cookie → `{ member:{ id, email,
  name } }` or `{ member:null }`. The portal calls this to gate itself.

`setupUrl` = `${origin}${basePath}/login?setup=<token>` — the `/login` page reads
`?setup=` and shows the set-password form.

### Server clients & read/data layer

- `lib/supabase/admin.js` (server-only) — `adminClient()` builds a
  `@supabase/supabase-js` client with `SUPABASE_SERVICE_ROLE_KEY`, schema
  `events`, **bypassing RLS**. Guarded: returns `null` if the key is absent.
  Never imported from a client component.
- `lib/portal/session.js` (server) — cookie read/write (`next/headers`), token
  hashing (`sha256`), `scrypt` hash/verify helpers, `getSessionMember()` (reads
  cookie → `portal_sessions` via `adminClient()` → member row).
- `lib/portal/reads.js` (server) — reads keyed by the session member's email
  (never a client-supplied email), via `adminClient()`:
  - orders → `event_orders` where `buyer_email ilike email`, embedding
    `event:events(name, event_date, cover_url)`, newest first.
  - memberships → `membership_members` where `email ilike email`, embedding
    `plan:ticketing_records(name, config)`.
  - tickets derived from confirmed orders (no separate table).
  Exposed via `GET /api/portal/data`, which resolves the session, fetches, and
  returns camelCase view models — the browser never holds a Supabase key for
  these rows.

### Routes & components (portal UI)

- `app/login/page.js` — renders `<MembersPortal />` (client). Reads `?setup=`.
- `components/portal/members_portal.jsx` — calls `/api/portal/me` on mount →
  signed-out shows `<AuthFlow>`, signed-in shows `<PortalShell>`.
- `components/portal/auth_flow.jsx` — **email-first**: step 1 email → `/lookup`;
  step 2 branches: password set → **password** field (`/login`); no password →
  a **"set up your account"** prompt that, **only on the member's confirm**,
  calls `/request-setup` and shows a **"check your email"** screen. A `?setup=`
  token shows the **set-password** form (`/set-password`). "Forgot password?"
  calls `/request-setup`.
- `components/portal/portal_shell.jsx` — header (brand + email + Sign out),
  tabs: **Memberships · Orders · Tickets**, each fetched from `/api/portal/data`.
- `my_memberships.jsx` / `my_orders.jsx` / `my_tickets.jsx` — read-only lists,
  reusing semantic tokens + shared kit (`EmptyState`, `StatusPill`), matching
  `event_public_page.jsx`. Loading / empty states throughout.

### Security posture (explicit)

- Passwords **scrypt-hashed server-side**, never stored or transmitted in clear.
- First-password / reset requires a **one-time emailed token** (ownership proof),
  so no account can be claimed by just knowing an on-file email.
- Sessions are **opaque, hashed at rest, httpOnly cookies**, revocable via the
  sessions table.
- Sensitive tables are **server-only**; the browser never queries them.
- **Follow-ups flagged (not in this slice):** request rate-limiting on
  `lookup`/`login`/`request-setup`; tightening the shared order/member tables'
  demo-open RLS. Called out so they aren't forgotten.

### What the user must do (cannot be done in code)

1. Run `npm run db:push` to create the three tables and the extended
   `buy_ticket` RPC.
2. **Add `SUPABASE_SERVICE_ROLE_KEY`** to `.env` (server-only, never
   `NEXT_PUBLIC_`). Required for the portal's server routes to read RLS-protected
   rows and the auth tables. Missing key → the portal degrades to a friendly
   "not available" state rather than crashing.
3. Ensure `sendSuiteEmail` delivery works for a new `events.portal_set_password`
   template (registered in the shared dash email service). Until it exists, sends
   fail gracefully and are logged.

## Out of scope (this slice)

- Buying / upgrading / renewing / cancelling memberships (Slices 3–4).
- Order cancel / refund / transfer (Slice 5).
- Rate-limiting and shared-table RLS hardening (flagged follow-ups).
- Social login, SSR of the portal, multi-org switching.

## Open decisions (defaults taken while user away — confirm)

1. **Custom members store, separate from Supabase Auth** — per your direction.
2. **First-password / reset via one-time email link** (secure) — the "no
   verification, set instantly" variant is rejected (account-takeover risk).
3. Route **`/login`**; members auto-created in `buy_ticket`.
4. Identity aggregation **global by email**.
5. Session lifetime ~30 days; setup-token TTL ~1 hour.
6. Refund model (Slice 5) — request → organizer approves.

## Success criteria

- Buying a ticket creates a passwordless `portal_members` row.
- `/login` (email-first): a member with no password gets a set-password email,
  sets a password, and lands in the portal; next time they log in with the
  password; a refresh keeps them signed in.
- No account can be claimed without receiving the emailed link.
- Signed in, the member sees only their own orders, tickets, and memberships.
- "Forgot password?" and "Sign out" work. `npx eslint` clean on new files.
