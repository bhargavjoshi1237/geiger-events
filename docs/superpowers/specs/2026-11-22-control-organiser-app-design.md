# Control: the organiser side of the app

Date: 22 November 2026

Status: **Building** — follows phases 1–2 of `2026-11-08-one-app-design.md` and replaces its phases 3–4 for the team lane.

## 1. Problem

- An organiser using the app has no reliable way into Control. The More screen only shows a Control row when `/api/portal/roles` detects the attendee's email on a team, so an organiser whose ticket email differs from their dashboard email (or whose detection call failed) sees nothing.
- Once in Control, the app is a dead-end stack: one screen with a "My tickets" button, no tab bar, and nothing to do except read which tools a role unlocks.
- Control can read projects and events but cannot change anything the dashboard can.

## 2. Outcome

1. **Switching lives in More, in both modes.** The attendee More screen always has an *Event team* group (switch to Control, or sign in to it). Control has its own More tab with *Switch to my tickets*. Neither mode is a trap.
2. **Control is a full app shell**: five tabs — Today, Events, Orders, Inbox, More — scoped to one active project, picked from a switcher.
3. **Organisers run events from the phone**: create and edit events, change status, manage tickets, approve and add guests, check people in by camera or search, refund/cancel/correct orders, answer buyer messages, broadcast to an event's buyers, and read sales and attendance.

Everything is enforced on the server with the same RBAC keys the dashboard uses, and every write runs as the signed-in user so database RLS applies exactly as it does on the dashboard.

## 3. Mode switching

| Where | Team signed in | Team signed out |
| --- | --- | --- |
| Attendee → More → *Event team* | **Switch to Control** (n projects) | **Sign in to Control** — subtitle names the detected organisations when the hint has them, otherwise "For organisers and event staff". A pending invitation adds an *Invitation waiting* row. |
| Control → More → *Mode* | **Switch to my tickets** when the portal is signed in; otherwise **Sign in to my tickets** (opens the attendee sign-in). | — |

- Switching persists the mode (`geiger.app.mode`), calls `dismissAll`, then `replace`s to the other root. The entry route keeps its existing resolution order.
- Signing out of Control lands on the attendee app when the portal is signed in, otherwise on sign-in. The two sessions still never share a 401 handler.

## 4. Control shell

```
src/app/control/
  _layout.tsx            Stack; redirects out when the team signs out
  (tabs)/_layout.tsx     Tabs + ControlTabBar
  (tabs)/index.tsx       Today
  (tabs)/events.tsx      Events
  (tabs)/orders.tsx      Orders
  (tabs)/inbox.tsx       Inbox
  (tabs)/more.tsx        More
  event/[id]/index.tsx   Event hub
  event/[id]/edit.tsx    Details editor
  event/[id]/tickets.tsx Tickets
  event/[id]/guests.tsx  Guests
  event/[id]/checkin.tsx Check-in (camera + search)
  event/[id]/orders.tsx  Event orders
  event/[id]/announce.tsx Broadcast to buyers
  event/new.tsx          Create event
  order/[id].tsx         Order detail
  thread/[id].tsx        Conversation
```

The `(tabs)` group sits *inside* the real `control/` segment, so `/` still resolves to the root index (the reason Control is not itself a group). Detail screens push over the tabs on the Control stack.

**Active project.** `ControlProvider` gains `projectId` (persisted in SecureStore as `geiger.control.project`), defaulting to the first project with a role. Today, Events, Orders and Inbox read it; the switcher is a Sheet opened from the Today title and from More.

**Capabilities.** `/api/control/me` and `/api/control/events/[id]` return `can` flags; the app hides tools a role lacks and hides write actions it cannot perform. The server re-checks every call regardless.

| Flag | RBAC key | Unlocks |
| --- | --- | --- |
| `events` | `events.events.view` | Events tab, event hub |
| `edit` | `events.event.edit` | Create/edit event, tickets, add/approve guests |
| `publish` | `events.event.publish` | Change event status |
| `delete` | `events.event.delete` | Delete event |
| `checkIn` | `events.check_in.view` | Check-in |
| `guests` | `events.guests.view` | Guest list |
| `orders` | `events.orders.view` | Orders tab, order detail |
| `refund` | `events.order.refund` | Refund, cancel, correct an order |
| `inbox` | `events.community.view` | Inbox, broadcast |
| `analytics` | `events.analytics.view` | Sales and attendance figures |
| `workspace` | `events.workspace.view` | (link to dashboard workspace) |

## 5. Server: `/api/control/*`

All routes use `withControl` (Bearer team token → `resolveStaffPrincipal`), authorise with `authorizeProjectAction` / `authorizeEventAction`, then read and write through `userClient(token)` — a Supabase client acting **as the user**, so RLS (`can_access_project`) applies exactly as on the dashboard. Request bodies are validated by pure functions in `lib/control/*` with `node --test` coverage.

| Method & path | Permission | Does |
| --- | --- | --- |
| `GET /me` | — | Projects, role, `can` (extended with the new flags) |
| `GET /projects/[p]/summary` | `events.events.view` | Today's numbers: sales and revenue today and over 7 days, upcoming events, pending approvals, unread threads |
| `GET /projects/[p]/events` | `events.events.view` | (exists) |
| `POST /projects/[p]/events` | `events.event.edit` | Create a Draft |
| `GET /projects/[p]/orders?status=&q=&before=` | `events.orders.view` | Orders, newest first, 50 per page |
| `GET /projects/[p]/threads` | `events.community.view` | Buyer conversations |
| `GET /events/[e]` | `events.events.view` | Full editable event + `can` + counts |
| `PATCH /events/[e]` | `events.event.edit` (+ `events.event.publish` when `status` changes) | Edit details / status |
| `DELETE /events/[e]` | `events.event.delete` | Soft delete |
| `GET·PUT /events/[e]/tickets` | view: `events.events.view`; write: `events.event.edit` | `metadata.tickets`; PUT merges by id so dashboard-only keys (type, group, releases, discounts) survive |
| `GET /events/[e]/guests?status=&q=` | `events.guests.view` | Registrations + checked-in state |
| `POST /events/[e]/guests` | `events.event.edit` | Add a guest (Confirmed, source "Manual") |
| `POST /registrations/[r]/decision` | `events.event.edit` | Approve / decline a Pending registration |
| `GET /events/[e]/checkin` | `events.check_in.view` | Admitted vs expected, recent admits |
| `POST /events/[e]/checkin` | `events.check_in.view` | Resolve a scan/code/id and admit via `checkin_admit_member` (capacity override with reason) |
| `GET /events/[e]/orders` | `events.orders.view` | The event's orders |
| `GET /events/[e]/analytics` | `events.analytics.view` | Sales by day (14 days), by ticket, check-in rate |
| `POST /events/[e]/announce` | `events.community.view` | Message every buyer of the event (`broadcast_message`) |
| `GET /orders/[o]` | `events.orders.view` | Order + refunds + timeline |
| `PATCH /orders/[o]` | `events.order.refund` | Correct buyer name/email, private note |
| `POST /orders/[o]/refund` | `events.order.refund` | `issue_order_refund` (record-only, as the dashboard) |
| `POST /orders/[o]/cancel` | `events.order.refund` | Cancel, release seats/booths |
| `GET /threads/[t]` · `POST` reply · `PATCH` status | `events.community.view` | Conversation |

Event status changes are gated on `events.event.publish` because they change what the public sees; the dashboard's free status select maps onto the same five values (Draft, Scheduled, On Sale, Sold out, Ended).

## 6. Check-in

- Camera scanning uses **`expo-camera`** (a new native module: needs a new build, OTA cannot deliver it). Without camera permission the screen falls back to search and manual code entry.
- A scan resolves through `scanQuery` on the server: a full order/registration id is looked up directly; an 8-character code is matched against the event's registrations and orders.
- Admission always goes through `checkin_admit_member` — the dashboard's capacity-aware path, so duplicate, ticket-status and hard-cap rules apply. A full area returns `capacity` and the app offers an override with a reason, recorded like a supervisor override.
- Every result fires a haptic (`Success` / `Error`) and a full-width result card.

## 7. Out of scope here

The dashboard has ~150 screens. Phone-native control covers the operational core above. These stay dashboard-only, reachable from the event hub's **Open in dashboard**: the page builder and design, seat-map and floor-plan editors, ticket types/tiers/discount rule editors, campaigns and email builders, workflows, conference program tools, inventory, venues and sourcing, settings, team and roles. Each can be brought to Control later on the same route pattern.

Real money movement is unchanged: refunds are record-only, exactly as on the dashboard (see `orders-module`).

## 8. Verification

- Server: `node --test lib/control/*.test.js`; `npx eslint` on changed server files.
- Mobile: `cd mobile && npx tsc --noEmit` and `npm run lint:mobile`.
- No migration. One new native dependency (`expo-camera`), so the next APK must be rebuilt before check-in scanning works on a device.
- Device check by the user.
