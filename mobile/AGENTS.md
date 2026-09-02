# Geiger Events — members mobile app

Expo SDK 57 / React Native 0.86 / React 19 / expo-router v57, **TypeScript**.
This app is the buyer-facing members app. It is a **client of the Next.js portal
API** in the parent directory (`../app/api/portal/*`) — it never talks to
Supabase directly except for the chat Realtime subscription.

## Non-negotiables

- **TypeScript, strict.** No `any` unless there is genuinely no type; prefer
  `unknown` + a narrow. Every API response gets a type in `src/types/portal.ts`.
- **Theme tokens only.** Every colour comes from `src/theme/tokens.ts`. Never
  write a hex literal in a screen or component. The palette mirrors the web
  app's dark theme exactly (`#161616` canvas, `#1a1a1a` subtle, `#202020` card,
  `#333333` border) so the app reads as part of the same suite. The `paper*`
  tokens are the deliberate exception: the QR pass is white so scanners read it.
- **Typography comes from `type.*`.** Geist ships as separate files per weight,
  so a `fontWeight` override without a matching `fontFamily` renders the wrong
  face — use `type.labelStrong` / `type.bodyStrong` / `fonts.semibold` instead.
  Import font weights from their per-weight subpath, never the package barrel.
- **StyleSheet, not inline objects.** `StyleSheet.create` at the bottom of each
  file. Inline styles only for values computed at render (animated, measured).
- **Shared primitives before bespoke layout.** Build from `src/components/ui/*`
  (`Screen`, `Card`, `Button`, `Input`, `Field`, `Pill`, `PulseDot`,
  `SectionTitle`, `EmptyState`, `Skeleton`, `ListRow`, `Segmented`, `Sheet`,
  `FilterChips`, `IconButton`, `IconTile`, `Perforation`). If one is *almost*
  right, extend it — do not fork layout into a screen.
- **Icons are lucide, via `src/components/ui/icons.tsx`.** Render `<Icon
  name="qr-code" />` and type icon props as `IconName`. Never import
  `@expo/vector-icons`, and never import the lucide barrel — Metro does not
  tree-shake, so each icon is deep-imported (`lucide-react-native/icons/<name>`)
  and registered in `ICONS`. Adding an icon means adding it there first. Names
  are lucide v1's, which differ from Feather's (`circle-play`, `square-pen`,
  `funnel`, `house`, `circle-check`).
- **Headers:** tab roots use `ScreenTitle` (large 28pt title); pushed screens use
  `ScreenHeader` (44pt back target, 17pt title).
- **Three list states, always:** loading (skeletons, not a bare spinner), empty
  (`EmptyState` with an action), and content. Filtered lists get a fourth
  "no results" state.
- **No mock data.** Screens render what the API returns. There are no seed
  arrays anywhere in this app.
- **Concise single-line comments.** Same style as the parent repo — explain why,
  never narrate what the next line does. No JSDoc blocks, no banner comments.
- Every touchable has `accessibilityRole` / `accessibilityLabel`, and a
  `hitSlop` when its box is under 44pt.

## Navigation

Five tabs: **Home, Tickets, Live, Inbox, More**. Inbox is one merged list over
four sources (organiser threads, announcements, event chats, Q&A) with filter
chips; the per-source screens still exist as pushed routes for deep links.
Orders, Memberships, Watch and Account hang off More. `/pass/[id]` lives outside
the tabs so the QR fills the screen with no chrome.

## Layout

```
src/
  app/          expo-router routes only — a route file renders a screen, nothing more
  components/   ui/ primitives + shared feature components
  lib/          api client, auth, formatters, push, realtime — no JSX
  state/        React context providers
  theme/        tokens.ts (colours, spacing, radii, type scale)
  types/        portal.ts — the API's view models
```

Import with the `@/*` alias (`@/lib/api`, `@/theme/tokens`), never a deep
relative path.

## API contract

- Base URL comes from `Constants.expoConfig.extra.apiBaseUrl`, overridable at
  runtime with `EXPO_PUBLIC_API_BASE_URL`. Prod is `https://geiger.studio/events`
  (the Next app has `basePath: "/events"` in production); a dev machine is
  `http://<lan-ip>:3000` with no base path.
- Auth is an **opaque session token** kept in `expo-secure-store`, sent as
  `Authorization: Bearer <token>`. It is *not* a JWT — never try to decode it.
- Every request sends `x-geiger-client: mobile`.
- A `401` from any call means the session is gone: clear the token and send the
  user to `(auth)/sign-in`.
- Server view models are already camelCase. Do not re-map them.

## Motion

`react-native-reanimated` v4 (worklets are in `react-native-worklets`) and
`react-native-gesture-handler`. Animation is part of the spec, not decoration:
list items stagger in, the tab bar springs, sheets are gesture-driven, the ticket
QR has a shared-element-style open. Keep durations 180–320ms and use spring
physics for anything a finger controls. Every meaningful action fires
`expo-haptics` (`Selection` for taps, `Success`/`Error` for outcomes).

Respect `useReducedMotion()` from Reanimated: when it is on, cross-fade instead
of translating, and skip the splash draw-in.
