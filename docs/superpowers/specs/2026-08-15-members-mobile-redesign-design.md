# Members mobile app redesign

Source: `C:\Users\space\Downloads\Mobile app redesign for members portal\Members App.dc.html`
(a Design Sync mockup export, "A members app, not the portal in a phone").

## Why

The current Expo app (`mobile/`) is a solid but fairly literal port of the web
portal's IA — five tabs (Home, Tickets, Watch, Community, More), detail views as
full pushed screens, no event-day mode, no dedicated door-scan surface. The
mockup redesigns the IA around three moments a member actually hits on a phone:
holding a ticket at a door, watching something live, and talking to the
organiser — and fixes several rough edges (dialog-heavy navigation, no
brightness boost on the QR pass, a stat-tiles grid on Home that adds noise
without adding utility).

## Scope decisions (confirmed with the user)

- **Full IA restructure**, not a reskin: tabs become **Home, Tickets, Live,
  Inbox, More**. Messages, Notifications, Community and Q&A collapse into one
  **Inbox** tab.
- **Docked live mini-player**: build it. Scoped honestly — this is a
  minimize/leave indicator + elapsed-timer bar that keeps the presence
  heartbeat alive while a member browses other tabs and lets them jump back
  into the room; it is not picture-in-picture video (RN doesn't give us that
  without a native module the app doesn't have).
- **APK build** happens once at the end, via the already-linked EAS project
  (`eas build --profile preview --platform android`).

## Explicitly out of scope for this pass

- **Light theme.** `theme/tokens.ts` is a static constant object consumed by
  ~20 `StyleSheet.create` files, and `app.json` forces
  `userInterfaceStyle: "dark"`. Flow 05 of the mockup exists to prove the
  token system *can* flip; wiring a live light/dark switch through every
  screen is an orthogonal architecture change, not a visual fix. Stays
  dark-only.
- **Apple/Google Wallet passes.** No pass-generation backend exists; the
  mockup's "Add to Wallet" button is dropped rather than shipped as a dead
  toggle.
- **Avatar photo upload.** No image-upload endpoint for the member profile;
  `Account` keeps the existing read-only initials `Avatar`.
- **Chat embedded inside a live room.** The mockup's Live Room screen shows an
  inline chat feed, but there's no channel scoped to a `parentSessionId` in
  the API — only event-wide and Q&A channels. Live rooms keep video + round
  clock + host broadcasts (`RoundRail`, already wired to
  `/api/portal/live/round`); room-scoped chat is a backend feature, not a UI
  one, and stays a follow-up.
- **Real screen-brightness boost** *is* in scope (see Tickets below) — flagged
  here only to note it needs a new dependency (`expo-brightness`).

## New navigation shell

`(app)/_layout.tsx` tabs become `home / tickets / live / inbox / more`.
`community`, `qa`, `messages`, `notifications` stop being their own tabs but
keep their route files (`href: null`) since Inbox rows deep-link into them
unchanged (`community/[id]`, `qa/[id]`, `messages/[id]`). `watch` also loses
its tab but keeps its routes — reached from the Live tab header and from More.

`TabBar.tsx`: new `TAB_META` — `home` (house), `tickets` (ticket), `live`
(radio, green dot badge when `counts.live` room is open), `inbox` (existing
mail/inbox icon, numeric badge = unread threads + unread notifications +
unread channel messages), `more` (menu). Icons come from whichever
`@expo/vector-icons` family actually has a line-style match per glyph (Feather
lacks `radio`/`inbox` — confirm and substitute from `Ionicons`/
`MaterialCommunityIcons` at implementation time, kept visually consistent:
outline weight, no fills).

A new `state/live_player.tsx` context holds `{ roomId, roomName, eventName,
startedAt } | null`. `live/[id].tsx` sets it on mount/unmount instead of (or
alongside) its own local heartbeat state. A `DockedPlayer` component renders
above `TabBar` (inside `(app)/_layout.tsx`) whenever the context is non-null
and the active route isn't already that room; tapping it pushes back to
`/live/[id]`, the `x` clears the context (and the heartbeat stops).

## Screen-by-screen

### Home (`home/index.tsx`)
- Drop the 4-tile stats grid (upcoming/tickets/memberships/spent) — decorative
  noise the mockup doesn't have and the "fix design issues" ask calls out.
- Hero card restyled to the mockup's proportions (20px radius, cover image,
  countdown as 4 equal tiles *inside* the card, action row: solid "Show pass"
  + calendar + directions icon buttons). "Show pass" now pushes the new
  full-screen Pass route instead of the ticket detail screen.
- New **live banner**: conditional card (green-tinted) when any ticket's event
  has an open live room right now, sourced from the existing `/api/portal/live`
  data already fetched by the Live tab — Home does a lightweight fetch of the
  same endpoint, or reads from a small shared cache to avoid a second full
  poll loop.
- Recent orders list stays, restyled to the mockup's row treatment (status pill
  + price, no change in data source).
- **Event-day mode**: when `nextTicket`'s date is today, replace the hero +
  banner + orders composition with a single white ticket-stub card (doors-open
  eyebrow, QR + order code + attendee, dashed perforation, "Open full pass"
  button) plus two rows below it — "Collect at the event" (from
  `entitlements`) and a directions row. This is a render branch on the
  existing `home/index.tsx`, not a new route.
- "Become a member" prompt: keep, but only as a slim single-line banner (not
  today on Home in the mockup) — still useful and already data-driven; move it
  below the live banner instead of its own prior placement if it reads as
  clutter next to the new banner.

### Tickets (`tickets/index.tsx`, `tickets/[id].tsx`)
- List: keep `Segmented` Upcoming/Past and `TicketStub`, restyle the stub's
  footer to match the mockup's countdown-pill + price + "Pass" button row
  (mostly `TicketStub` prop/style tweaks, the component's shape is already
  close).
- Detail becomes a **bottom sheet** (`Sheet`) triggered by tapping a ticket row
  (tapping the row's own "Pass" button skips the sheet and deep-links straight
  to the full-screen Pass). Sheet content: action row (Show pass / calendar /
  directions), info table (When/Where/Organiser/Order), "Collect at the
  event", "Message organiser" (routes to `messages/new` pre-filled with the
  order context, as today) and "Refund" (opens the existing `RefundSheet`).
  `tickets/[id].tsx` as a pushed route goes away in favor of local sheet state
  in `tickets/index.tsx`; keep the route only if a deep link
  (`/tickets/:id`) needs to resolve to something — in that case it opens
  Tickets with the sheet pre-opened rather than being its own screen.
- **New: full-screen Pass** (`tickets/pass/[id].tsx` or similar) — white
  background even in the dark app shell, `expo-brightness` bump to max on
  focus and restore on blur/unmount, large QR (`TicketQr`, reused), order
  code, attendee/doors/paid rows, "N passes" + no-op-safe wallet button
  removed per scope. `chevron-down` dismiss, no tab bar.

### Live (`live/index.tsx`, `live/[id].tsx`) + Watch (`watch/*`, unchanged routes)
- Live tab keeps its polling list of rooms but restyles the top of the list
  into a **featured live card** (thumbnail, LIVE badge, viewer count, "Join
  room") when something's open now, then a **"Coming up" schedule list**
  (time-block row style) for the rest — same `LiveRoom[]` data, new layout.
  Add a header action linking to `watch/index` ("Library").
- `live/[id].tsx`: restyle to header-overlaid video controls (minimize →
  clears the docked-player-eligible route but keeps context set, so leaving
  via the dock's own logic is what actually docks it; fullscreen toggle uses
  `expo-video`'s existing fullscreen support), two stat tiles (round clock via
  `RoundRail`'s existing countdown, participant count from `room.liveNow`),
  "From the host" broadcasts (`RoundRail` already surfaces these — pull them
  into a styled card instead of the current inline strip).
- `watch/*` unchanged functionally; only reachable via a link from Live's
  header and from More instead of its own tab.

### Inbox (new tab, new `inbox/index.tsx`)
The single biggest new surface. Aggregates four existing, separately-fetched
lists — no new backend calls beyond what `usePortalData()` and the two
`ChannelList` kinds already fetch:
- `threads` (organiser DMs) → rows with an order-context pill.
- `notifications` → rows with a `megaphone`-style icon chip.
- event channels (`kind="event"`, fetched the way `community/index.tsx`
  already does) → group-chat rows (member count pill) or announce-only rows
  (posting-mode gated, per `Channel.postingMode`).
- qa channels (`kind="qa"`) → Q&A rows.
Merge-sort by each item's last-activity timestamp; filter chips (All /
Organiser / Updates / Chats) computed as counts over the merged list, chip
selection just filters client-side. Tapping a row routes to the existing
detail screen for its kind (`messages/[id]`, `community/[id]`, `qa/[id]`); a
notification row marks itself read and, if it references an order/ticket,
routes there. Compose button (top-right) opens `messages/new` unchanged.

This replaces `community/index.tsx` and `qa/index.tsx` as *navigation
entries* (their route files and `[id]` screens stay — see nav shell above).
`messages/index.tsx` and `notifications/index.tsx` become effectively
superseded by Inbox; leave the route files in place (unlinked) rather than
deleting, since `more/index.tsx`'s "Q&A threads" and other deep links may
still want a dedicated list view — decide per-screen during implementation
whether a route becomes dead code to delete or a still-linked secondary view
(the mockup itself keeps a standalone Q&A list reachable from More even
though Q&A also surfaces in Inbox).

### More (`more/index.tsx`) + Account (`account/index.tsx`)
- Restyle into three bordered card groups per the mockup: **content
  shortcuts** (Memberships, Orders & receipts, Watch library, Q&A threads —
  each with a trailing count), **app settings** (Push notifications toggle,
  reusing existing `lib/push.ts` registration state — Appearance segmented
  control dropped, see scope-out), **account/security** (Account →
  password/profile, Sign out). Keep the existing sign-out confirm `Sheet`.
- Account screen restyles into the mockup's card groups (profile / security /
  danger zone) using existing fields only (name, phone, disabled email row,
  change-password link, sign-out-everywhere) — no avatar upload, no device
  list (no backing endpoint), per scope-out.

## New dependency

- `expo-brightness` — for the full-screen Pass screen's brightness boost.
  Needs an `npx expo install expo-brightness` (keeps it SDK-57-compatible)
  and, if a plugin/permission entry is required on Android/iOS, an `app.json`
  update.

## Verification

- `npx tsc --noEmit` and `npm run lint` clean after each screen.
- Run in Expo Go or a dev client to click through: sign-in → Home (both
  normal and event-day state, may need to fudge a ticket's date locally to
  see event-day mode) → Tickets list → ticket sheet → full-screen Pass
  (confirm brightness restores on back) → Live list → a room (confirm dock
  appears on nav-away, tapping it returns) → Inbox (all four row kinds render,
  filters work) → More → Account.
- `eas build --profile preview --platform android` once the above is clean;
  report the build URL/APK link back.
