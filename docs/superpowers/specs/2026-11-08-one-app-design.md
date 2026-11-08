# One App: attendee app with Control mode

Date: 8 November 2026

Status: **Proposed** — phases 1–2 have implementation plans; phases 3–7 get their own plans when reached.

Product: Geiger Events — `mobile/` (Expo), the members portal API, and the dashboard's Broadcast & On-demand screens.

## 1. Outcome

There is **one** Geiger Events app in the stores.

- Everybody signs in as an **attendee** through the members portal, as today.
- When the app detects that the signed-in person is also on an event team, it offers **Control**: a second mode for running events. Control opens after a one-time team sign-in. From then on, switching between modes is instant.
- Someone with a team account and no tickets can sign straight into Control from the sign-in screen.

On the dashboard, **Branded App** becomes the single place to configure the app. **Mobile Event App** is retired and its conference sections fold into Branded App. Every toggle on that screen must change what the app does. A toggle that does nothing is removed until its phase makes it real.

## 2. Where things stand (8 Nov 2026)

| Area | Today |
| --- | --- |
| Branded App (`components/internal/screens/branded/branded_app.jsx`) | Frontend-only `useState`. Resets on reload. "Request new build" is a `setTimeout`. Uploads are `blob:` URLs. |
| Mobile Event App (`components/internal/screens/conference/mobile_app.jsx`) | Persists a `conference_records` row with `module: "mobile_app"`. Nothing reads it. |
| `mobile/` | Fixed 5 tabs (`TAB_ORDER`), dark-only static tokens. No config read. Email + password portal auth only. No conference sections. No staff mode. |
| Portal identity | `events.portal_members` / `portal_sessions`: one account per email across all projects. Every session is email-verified, because a password can only be set through an emailed one-time link (or an emailed operations invitation). |
| Suite identity | Supabase Auth (geiger-dash). Project access comes from org membership (`public.organization_users`). RBAC lives in `events.role_grants` + `public.roles`. `lib/operations/server/access.js` already enforces RBAC server-side for Bearer-JWT callers. |
| Bridges | **None.** The operations spec rules it out explicitly: "Portal session is never staff" (`docs/superpowers/specs/2026-10-02-operations-complete-design.md`). The desktop shell already gets a Supabase session natively: password in-app, or the `/events/desktop/handoff` magic-link handoff. |
| Code-gated staff | `/checkin`, `/door`, `/kiosk` and `/issue` use anon RPCs plus an access code (`events.checkin_staff_roles`). No identity is involved. |
| Operations crew | Presenters, evaluators, staff and volunteers act through `/api/portal/operations/[eventId]`, using the **portal** session plus an accepted invitation. |

## 3. Access lanes

The app recognises four ways of being "on the team". Each has its own proof, and each grants only what that proof covers.

| Lane | Who | Proof | Grants | Phase |
| --- | --- | --- | --- | --- |
| Attendee | Anyone with a portal account | Portal session | Their own tickets, orders, content | exists |
| Team | Org members and RBAC role holders | **Supabase Auth session** (password, or browser handoff) | RBAC-evaluated Control tools per project or event | 2–3 |
| Crew | Operations invitees | Portal session plus an accepted invitation | The existing operations-portal actions (placements, attendance, evaluations, tasks) | 4 |
| Device code | Door and desk staff with no account | Access code | Scanner and issue-desk RPCs for one event | 3–4 |

### The one rule

**A portal session never becomes a team session.** The portal session's verified email is used to *detect* team access and offer Control. *Activating* Control always requires signing in with the team account.

Why: portal passwords live outside the suite's sign-in policies (SSO, passkeys), and the portal has no rate limiting yet. Minting a suite session from a portal session, which the desktop handoff's `generateLink` trick would make easy, would turn every buyer password into a way into organisation data. This is the same conclusion the operations spec reached.

### Detection (Phase 2)

`GET /api/portal/roles` (portal session) returns:

- **`team`**: comes from `events.suite_access_for_email`, a `SECURITY DEFINER` function executable by `service_role` only. It returns the organisations whose `organization_users` include an auth user with that email, plus any pending `project_members` invitation addressed to it.
- **`crew`**: comes from `events.ops_identity_links` (`kind = 'portal'`, `principal_id = member.id`), and includes event names.

Detection grants nothing. Showing organisation names to the holder of an email-verified session is fine.

### Team sign-in (Phase 2)

The app uses `@supabase/supabase-js` **for Auth only**. It never queries tables. The session is stored in chunked SecureStore.

- **Email + password:** `signInWithPassword`, in-app. This is the same thing the desktop shell does.
- **Google, GitHub, SSO, passkey:** the app opens `https://geiger.studio/events/desktop/handoff?state=m_…` in an auth session. The existing handoff route signs in on dash if needed and mints a one-time magic-link `token_hash`.
  - The return page sees the `m_` state prefix and deep-links to `geigerevents://team-auth` instead of `geiger-events://auth`.
  - The app calls `verifyOtp({ token_hash, type: "magiclink" })`.
  - **No geiger-dash change is needed.** Dash's `next=` allowlist matches the handoff path, and the state rides in the query.

### Server enforcement

Control endpoints live under `/api/control/*`:

- They take `Authorization: Bearer <supabase access token>`, resolved by the existing `resolveStaffPrincipal`.
- They authorise with `authorizeProjectAction` / `authorizeEventAction`, which check verified org membership plus `@geiger/rbac` `evaluate`.

This is real server-side enforcement, unlike the dashboard's UI-only gating. A user with no grant yet in a project gets one minted, exactly as the dashboard does: `events.rbac_ensure_membership`, called as that user.

### Mode

The current mode (`attendee` or `control`) is persisted on the device. App start resolves it like this:

1. Control, if team is signed in and the last mode was control.
2. Otherwise attendee, if the portal is signed in.
3. Otherwise control, if only team is signed in.
4. Otherwise sign-in.

Signing out of the team never signs out the attendee, and the reverse is also true. The two tokens never share a 401 handler.

## 4. App configuration (Phase 1)

### Model

`lib/app_config/model.js` is shared by the dashboard and the portal route.

- **`sections`**: 14 booleans.
  - Built today: `memberships`, `live`, `watch`, `orders`, `community`, `qa`, `messages`, `notifications`.
  - Saved now, rendered from Phase 5: `agenda`, `speakers`, `sponsors`, `map`, `networking`, `discussions`.
- **`home`**: `welcome` (280 characters), `liveStrip`, `recentOrders`, and `shortcuts`. Shortcuts are an ordered list of at most 4 keys from `community`, `watch`, `memberships`, `live`, `orders` and `qa`, and must be enabled sections.
- **`whiteLabel`**: identity, theme and store links. These are used only by Phase 7 white-label builds. The shared app keeps the Geiger look.

### Storage

`events.app_configs` holds one row per project, with `can_access_project` RLS like `design_settings`. The portal reads it with the service role. The migration copies any legacy `mobile_app` record into it.

### Merge rule for the shared app

A member can hold tickets from several organisers, so the app shows the union:

- A section is on if **any** connected project leaves it on.
- A project with no saved row counts as defaults, meaning all on. Organisers who never touched the screen see no change.
- `welcome` and `shortcuts` come from the project only when the member is connected to exactly one project. Otherwise the app uses defaults.
- Turning a section off hides it from navigation (tabs, More, Home, Inbox). Deep links from push still open it.

### Retired with Phase 1

- The Mobile Event App screen, its sidebar entry, its registry entry and its export.
- Free-text "home cards", replaced by shortcut keys.
- The simulated build button.
- The Sign-in & access and Push cards. They return, wired up for real, in Phase 6.
- Asset uploads. They return with storage in Phase 7.

## 5. Roadmap

| Phase | Delivers | Server work | `db:push` | Plan |
| --- | --- | --- | --- | --- |
| **1. One config** | Branded App persists. The app honours sections, home welcome and shortcuts. Mobile Event App is retired. | `GET /api/portal/app-config` | `app_configs` | `plans/2026-11-08-one-app-1-app-config.md` |
| **2. Control mode** | Role detection, team sign-in (password and browser), mode switch. Control home lists projects and events with your role. The event screen shows your access. | `GET /api/portal/roles`, `GET /api/control/me`, `GET /api/control/projects/[id]/events` | `suite_access_for_email` | `plans/2026-11-08-one-app-2-control-mode.md` |
| 3. Check-in in Control | Camera scan, search, admit and live counts for team members. Device-code unlock for staff with no account. | `/api/control/events/[id]/checkin/*`, which needs a member-session search RPC beside the existing `checkin_admit_member` | yes | later |
| 4. Crew and desk | "Your event work" on the existing operations portal API. Issue desk by code. | `wantsTokenInBody` on `operations/invitations/register` | no | later |
| 5. Conference sections | Agenda (plus assigned agendas), Speakers, Sponsors, Map, Networking, Discussions | New ticket-scoped portal reads for agenda, speakers, sponsors and exhibitor names. Networking (`/api/portal/meetings`) and Discussions (`/api/portal/boards`) already exist. | no | later |
| 6. Sign-in and push | Attendee email code / Apple / Google. Push categories (reminders, live alerts) with per-member preferences. | Push senders beyond announcements | maybe | later |
| 7. White-label builds | Per-organiser name, bundle ids, icon, splash and accent; `app.config.js` reads the project's `whiteLabel` at build time; EAS pipeline. | Storage for assets | yes | later |

## 6. Risks found while researching (outside this program)

- **Realtime token:** `/api/portal/chat/realtime-token` signs `role: "authenticated"` JWTs for portal members. `events.can_access_project()` returns true for any project with `organization_id is null`, so such a token can pass member RLS on org-less projects.
- **Door sales:** sell through `buy_ticket` with a client-supplied `p_price`. The access code only gates the UI.
- **Live / Watch:** reach only **active members** (`loadMemberGrants` returns null otherwise). Ticket-only attendees see nothing there, even for free rooms. Phase 5's agenda must not inherit this.
- **Hidden routes:** the `Tabs.Screen name="live"` (and similar) hidden-route declarations in `mobile/src/app/(app)/_layout.tsx` may not match the registered route names (`live/index`). This is unverified at runtime.

## 7. Verification

- **Server logic:** `node --test <file>` (the root has no test script, and none should be added).
- **Mobile:** `cd mobile && npx tsc --noEmit`, plus `npm run lint:mobile` from the root.
- **Dashboard:** `npx eslint <changed files>`.
- **Device check:** the user does it on their own device; there is no self-driven visual testing.
- **Database:** migrations are pushed by the user with `! npm run db:push`.
