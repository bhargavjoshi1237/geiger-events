# Landing spotlight playgrounds + Title-Case headings

**Date:** 2026-07-19
**Area:** `app/page.js` (public landing) + shared workspace screens

## Goal

On the public landing page (`/`), replace the three static `SpotlightVisual`
placeholder panels (Operations / Live day / For your team) with **live, focused,
1:1 playgrounds** of real app surfaces — mirroring the hero's live
`EventsPlaygroundShowcase` treatment but scaled to a single screen each. Also
Title-Case every `h1`/`h2` on the page.

## Decisions (agreed with user)

- **Capitalize** = Title Case, applied by rewriting heading *text* (not CSS).
- **Mapping** = real 1:1 app screens (recommended mapping).
- **Form factor** = focused single screen in a browser-chrome frame (no sidebar).
- **Layout** = side-by-side (keep the alternating spotlight rhythm; the playground
  replaces the `SpotlightVisual` half).
- **Live day** = option **B**: give the real `RealTimeAttendanceScreen` a bundled
  demo-attendance seed so the board shows populated events + arrival bars on the
  public page (where there is no live session).

## Blocking bug already fixed

`ProfileDropdown` called `useProject()`, which throws outside a `ProjectProvider`.
The landing `Header` renders it for signed-in users with no provider → page crash.
Fix: added non-throwing `useOptionalProject()` to `context/project-context.js` and
switched `ProfileDropdown` to it. (Done.)

## Architecture

Screens that mount on the landing page must tolerate having **no
`ProjectProvider`**. Rather than wrap the landing page in a provider, switch the
two embedded workspace screens to the non-throwing `useOptionalProject()` (returns
`null` with no provider; identical behavior inside the workspace, which always has
one). The attendee page already takes an `event` prop and needs nothing.

### Components

- **`components/landing/browser_frame.jsx`** (new) — shared chrome: traffic-light
  dots header + optional label + a fixed-height (`h-[460px]`), internally
  scrollable content area (hidden scrollbar, like `EventsPlayground`). Semantic
  tokens only. Wraps children in `Suspense` (children may read `useSearchParams`).
- **`components/landing/spotlight_playgrounds.jsx`** (new) — three tiny client
  components, each `dynamic(() => …, { ssr: false })`-importing its screen so the
  landing bundle stays lean, each rendered inside a `BrowserFrame`:
  - `OperationsPlayground` → real `EventsOverviewScreen` (static sample analytics).
  - `LiveDayPlayground` → real `RealTimeAttendanceScreen` with `demo` prop.
  - `SelfServePlayground` → real `EventPublicPageContent` with a bundled sample
    event (`findEventById` / `EVENTS[0]`, Summer Product Launch) and
    `defaultPageDesign()`.

### Screen changes

- **`events_overview.jsx`** — `useProject()` → `useOptionalProject()?.projectId`.
  No other change (already renders from static sample data).
- **`real_time_attendance.jsx`** — `useProject()` → `useOptionalProject()`. Add an
  optional `demo` prop: when set, seed `events`/`regs`/`attendance` from a bundled
  `DEMO_ATTENDANCE` fixture and **skip** the fetch effect + polling interval.
  Production usage (no prop) is unchanged.
- **`components/internal/screens/checkin/demo_attendance.js`** (new) — sample
  fixture matching the normalized shapes the screen reads:
  - events: `{ id, name, date, sold, checkinSessions?.sessions }`
  - regs: `{ eventId, status: "Confirmed" | "Checked-in" }`
  - attendance: `{ id, eventId, status: "in", registrationId, gate?, sessionId? }`
  3–4 events with partial arrivals so bars sit mid-progress, plus a couple of
  gate/session chips and at least one "Live" event.

### `app/page.js`

- Title-Case: hero `h1`, the three spotlight `h2`s (`title` strings in
  `spotlights`), both `capabilityGroups[].heading`, "Questions & Answers", and
  "Try Geiger Now".
- Add a `playground` component reference to each `spotlights` entry; in the map,
  render `<spotlight.playground />` in place of `<SpotlightVisual icon={icon} />`.
- Remove the now-unused `SpotlightVisual` component and any icon imports it alone
  used (keep icons still referenced elsewhere).

## Non-goals

- No change to the hero `EventsPlaygroundShowcase`.
- No new persistence/SQL; the demo fixture is a static in-file constant used only
  by the landing playground (guarded by the explicit `demo` prop).
- No full-workspace shell in the spotlights (focused single screen only).

## Verification

- `npx eslint` clean on all changed/new files.
- Landing page renders for both signed-out and signed-in users (no `useProject`
  crash); the three playgrounds are interactive (overview filters, attendee
  ticket steppers, populated attendance board).
