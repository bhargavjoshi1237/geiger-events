# Members Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Expo members app (`mobile/`) from a 5-tab portal-in-a-phone
into the mockup's IA (Home, Tickets, Live, Inbox, More), add an event-day mode,
a full-screen brightness-boosted ticket pass, and a docked live mini-player,
then produce a preview APK via EAS.

**Architecture:** Frontend-only change against the existing `/api/portal/*`
client (`lib/api.ts`) and data hooks (`state/data.tsx`, `state/session.tsx`) —
no backend/API changes. New screens/components are added under `src/app`,
`src/components`, and `src/state`; existing detail routes
(`community/[id]`, `qa/[id]`, `messages/[id]`) are kept and re-targeted from a
new aggregating Inbox screen instead of their own tabs.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, expo-router v57,
TypeScript strict, `react-native-reanimated` v4, `@expo/vector-icons`.

## Global Constraints

- TypeScript strict; every new file typed, no `any` (project rule, `AGENTS.md`).
- Every colour comes from `theme/tokens.ts` — no hex literals in screens/components.
- `StyleSheet.create` at file bottom; no inline style objects except animated/measured values.
- Build screens from `src/components/ui/*` before writing bespoke layout.
- Three list states always: loading (skeleton), empty, content; filtered lists get a "no results" state too.
- No mock/seed data — screens render only what the API returns.
- Concise single-line comments only (why, never what).
- Every touchable has `accessibilityRole`/`accessibilityLabel`, `hitSlop` if its box is under 44pt.
- No automated test suite exists in this app (`package.json` has no test runner) — verification per task is `npx tsc --noEmit`, `npm run lint`, and a manual click-through in Expo Go/dev client, not unit tests.
- Design source of truth: `docs/superpowers/specs/2026-08-15-members-mobile-redesign-design.md` — re-read it if a task's intent is unclear.

---

### Task 1: Dependency + token groundwork

**Files:**
- Modify: `mobile/package.json` (adds `expo-brightness`)
- Modify: `mobile/app.json`
- Modify: `mobile/src/theme/tokens.ts`

**Interfaces:**
- Produces: `radius.xxl = 24` (new token later tasks use for the Pass screen and event-day card), `colors.avatarGradientStart = "#3a3a3a"`, `colors.avatarGradientEnd = "#1e1e1e"` (used by Home hero + Inbox monogram chips), no other token changes.

- [ ] **Step 1: Install `expo-brightness`**

Run: `npx expo install expo-brightness`
Expected: `package.json` gets an `expo-brightness` entry pinned to the SDK 57-compatible version; `package-lock.json` updates.

- [ ] **Step 2: Confirm no config plugin is required**

`expo-brightness` needs no `app.json` plugin entry or Android permission on
SDK 57+ (it uses `WRITE_SETTINGS`-free system brightness APIs on both
platforms for the app-scoped brightness override). Run:
`npx expo-doctor` and confirm no new warnings about `expo-brightness`.
Expected: clean (or only pre-existing warnings).

- [ ] **Step 3: Add the two new tokens**

Edit `mobile/src/theme/tokens.ts`, inside `radius`:

```ts
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 999,
} as const;
```

And inside `colors`, after `overlay`:

```ts
  avatarGradientStart: "#3a3a3a",
  avatarGradientEnd: "#1e1e1e",
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` (from `mobile/`)
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/app.json mobile/src/theme/tokens.ts
git commit -m "chore(mobile): add expo-brightness and redesign theme tokens"
```

---

### Task 2: Global live-player context + docked mini-player

**Files:**
- Create: `mobile/src/state/live_player.tsx`
- Create: `mobile/src/components/DockedPlayer.tsx`
- Modify: `mobile/src/app/_layout.tsx` (wrap the provider)

**Interfaces:**
- Produces:
  ```ts
  export type LivePlayerState = { roomId: string; roomName: string; eventName: string; startedAt: number } | null;
  export function LivePlayerProvider({ children }: { children: React.ReactNode }): JSX.Element;
  export function useLivePlayer(): {
    playing: LivePlayerState;
    dock(room: { id: string; name: string; eventName: string }): void;
    clear(): void;
  };
  ```
  `DockedPlayer` reads `useLivePlayer()` and `usePathname()`; renders `null` when
  `playing` is `null` or the current path already is `/live/${playing.roomId}`.
- Consumes: nothing from other tasks (self-contained); Task 8 (Live room screen) and Task 7 (Live tab shell) will call `dock`/`clear`.

- [ ] **Step 1: Write the context**

`mobile/src/state/live_player.tsx`:

```tsx
// Tracks the one live room a member has "left running" so a docked bar can
// bring them back to it — RN gives us no real background video, so this is
// a presence indicator + resume shortcut, not picture-in-picture.
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type LivePlayerState = {
  roomId: string;
  roomName: string;
  eventName: string;
  startedAt: number;
} | null;

type LivePlayerContextValue = {
  playing: LivePlayerState;
  dock(room: { id: string; name: string; eventName: string }): void;
  clear(): void;
};

const LivePlayerContext = createContext<LivePlayerContextValue | null>(null);

export function LivePlayerProvider({ children }: { children: React.ReactNode }) {
  const [playing, setPlaying] = useState<LivePlayerState>(null);

  const dock = useCallback((room: { id: string; name: string; eventName: string }) => {
    setPlaying({ roomId: room.id, roomName: room.name, eventName: room.eventName, startedAt: Date.now() });
  }, []);

  const clear = useCallback(() => setPlaying(null), []);

  const value = useMemo(() => ({ playing, dock, clear }), [playing, dock, clear]);

  return <LivePlayerContext.Provider value={value}>{children}</LivePlayerContext.Provider>;
}

export function useLivePlayer(): LivePlayerContextValue {
  const ctx = useContext(LivePlayerContext);
  if (!ctx) throw new Error("useLivePlayer must be used within LivePlayerProvider");
  return ctx;
}
```

- [ ] **Step 2: Write the docked bar component**

`mobile/src/components/DockedPlayer.tsx`:

```tsx
import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import { selectionFeedback } from "@/lib/haptics";
import { useLivePlayer } from "@/state/live_player";
import { colors, radius, spacing, type } from "@/theme/tokens";

function elapsed(startedAt: number): string {
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

export function DockedPlayer({ bottom }: { bottom: number }) {
  const { playing, clear } = useLivePlayer();
  const pathname = usePathname();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [playing]);

  if (!playing || pathname === `/live/${playing.roomId}`) return null;

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      style={[styles.wrap, { bottom }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Return to ${playing.roomName}`}
        style={styles.bar}
        onPress={() => {
          selectionFeedback();
          router.push(`/live/${playing.roomId}`);
        }}
      >
        <View style={styles.thumb}>
          <Feather name="radio" size={16} color={colors.foreground} />
        </View>
        <View style={styles.textStack}>
          <Text style={styles.name} numberOfLines={1}>
            {playing.roomName}
          </Text>
          <View style={styles.liveRow}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>{`Live · ${elapsed(playing.startedAt)}`}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave room"
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation();
            selectionFeedback();
            clear();
          }}
          style={styles.close}
        >
          <Feather name="x" size={16} color={colors.textSecondary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
  },
  bar: {
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  thumb: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceActive,
    alignItems: "center",
    justifyContent: "center",
  },
  textStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...type.label,
    color: colors.foreground,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    ...type.caption,
    color: colors.textSecondary,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

- [ ] **Step 3: Wire the provider into the root layout**

In `mobile/src/app/_layout.tsx`, wrap the existing provider tree with
`LivePlayerProvider` (inside `SessionProvider`/`PortalDataProvider`, order
doesn't matter since it's independent state — place it adjacent to
`PortalDataProvider`). Import `{ LivePlayerProvider } from "@/state/live_player"`.
Do not render `DockedPlayer` here — it belongs in `(app)/_layout.tsx` (Task 3)
where the tab bar height is known.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/state/live_player.tsx mobile/src/components/DockedPlayer.tsx mobile/src/app/_layout.tsx
git commit -m "feat(mobile): add global live-player context and docked mini-player bar"
```

---

### Task 3: New tab shell (Home, Tickets, Live, Inbox, More)

**Files:**
- Modify: `mobile/src/components/TabBar.tsx`
- Modify: `mobile/src/app/(app)/_layout.tsx`
- Create: `mobile/src/app/(app)/inbox/index.tsx` (stub, replaced fully in Task 9)

**Interfaces:**
- Consumes: `useLivePlayer()` from Task 2, `usePortalData().counts` (existing).
- Produces: `TAB_BAR_HEIGHT` unchanged at `60`; tab route names `home | tickets | live | inbox | more`.

- [ ] **Step 1: Create the Inbox stub route**

`mobile/src/app/(app)/inbox/index.tsx`:

```tsx
import React from "react";

import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";

// Placeholder so the "inbox" tab route resolves before Task 9 replaces this.
export default function InboxScreen() {
  return (
    <Screen scroll>
      <SkeletonList rows={4} />
    </Screen>
  );
}
```

- [ ] **Step 2: Update `TAB_META` and badge routing in `TabBar.tsx`**

Replace the existing `TAB_META` and `BADGE_ROUTES` in
`mobile/src/components/TabBar.tsx`:

```ts
const TAB_META: Record<
  string,
  {
    label: string;
    icon: React.ComponentProps<typeof Feather>["name"] | null;
    mci?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  }
> = {
  home: { label: "Home", icon: "home" },
  tickets: { label: "Tickets", icon: "credit-card" },
  live: { label: "Live", icon: null, mci: "access-point" },
  inbox: { label: "Inbox", icon: null, mci: "inbox-outline" },
  more: { label: "More", icon: "menu" },
};

const BADGE_ROUTES: Record<string, (counts: ReturnType<typeof usePortalData>["counts"]) => number> = {
  inbox: (c) => (c.messages || 0) + (c.notifications || 0),
};
```

Add the import: `import { MaterialCommunityIcons } from "@expo/vector-icons";`
at the top alongside the existing `Feather` import. In `TabButton`, replace
the single `<Feather name={icon} .../>` render with a branch:

```tsx
{meta.mci ? (
  <MaterialCommunityIcons name={meta.mci} size={22} color={tint} />
) : (
  <Feather name={meta.icon!} size={22} color={tint} />
)}
```

(`meta` is looked up the same way the current code already does via
`TAB_META[route.name]` — thread it through `TabButton`'s props instead of
just `icon`, i.e. change `TabButtonProps.icon` to `meta: TAB_META[string]`
and update the call site in the `visible.map` loop accordingly.) Also add a
small green live-indicator dot next to the Live tab's icon when
`usePortalData()`'s data shows an open room — reuse the existing `badge`
style (already renders a dot when `badge > 0`); for the `live` route pass
`counts.live ? 1 : 0` — this requires adding a `live` count to
`usePortalData().counts` in Task 7, so for now pass `0` (dot added once
Task 7 lands; leave a literal `0`, not a TODO comment, since `0` is correct
behavior until that count exists).

- [ ] **Step 3: Update `(app)/_layout.tsx`**

Replace the `Tabs.Screen` list in `mobile/src/app/(app)/_layout.tsx`:

```tsx
<Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
  <Tabs.Screen name="home" options={{ title: "Home" }} />
  <Tabs.Screen name="tickets" options={{ title: "Tickets" }} />
  <Tabs.Screen name="live" options={{ title: "Live" }} />
  <Tabs.Screen name="inbox" options={{ title: "Inbox" }} />
  <Tabs.Screen name="more" options={{ title: "More" }} />

  {/* Route groups that live inside the shell without their own tab. */}
  <Tabs.Screen name="watch" options={{ href: null }} />
  <Tabs.Screen name="community" options={{ href: null }} />
  <Tabs.Screen name="qa" options={{ href: null }} />
  <Tabs.Screen name="messages" options={{ href: null }} />
  <Tabs.Screen name="notifications" options={{ href: null }} />
  <Tabs.Screen name="orders" options={{ href: null }} />
  <Tabs.Screen name="memberships" options={{ href: null }} />
  <Tabs.Screen name="account" options={{ href: null }} />
</Tabs>
```

Below the `<Tabs>` element (as a sibling, absolutely positioned like the
existing `TabBar` is), render `<DockedPlayer bottom={TAB_BAR_HEIGHT + insets.bottom + spacing.sm} />`
— since `AppLayout` doesn't currently read safe-area insets, add
`import { useSafeAreaInsets } from "react-native-safe-area-context";` and
`const insets = useSafeAreaInsets();` at the top of `AppLayout`, and
`import { TAB_BAR_HEIGHT } from "@/components/TabBar";`,
`import { DockedPlayer } from "@/components/DockedPlayer";`,
`import { spacing } from "@/theme/tokens";`.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run: `npx expo start`, open in Expo Go/dev client, sign in, confirm the tab
bar shows Home/Tickets/Live/Inbox/More with correct icons and the app
doesn't crash navigating each tab (Live and Inbox render their pre-existing/
stub content).

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/TabBar.tsx mobile/src/app/(app)/_layout.tsx mobile/src/app/(app)/inbox/index.tsx
git commit -m "feat(mobile): restructure tab bar to Home/Tickets/Live/Inbox/More"
```

---

### Task 4: Home screen redesign

**Files:**
- Modify: `mobile/src/app/(app)/home/index.tsx`

**Interfaces:**
- Consumes: `usePortalData()` (existing shape), `useSession()` (existing),
  `entitlements` (existing `Record<string, Entitlement[]>`), `api` from
  `lib/api.ts` for a lightweight `/api/portal/live` read (same call
  `live/index.tsx` makes).
- Produces: no new exports (route component only).

- [ ] **Step 1: Remove the stats grid**

Delete the `statsGrid`/`StatTile`/`AnimatedValue` block and its render call
from `home/index.tsx` (the `<View style={styles.statsGrid}>...</View>`
`Animated.View` and the now-unused `StatTile`, `AnimatedValue` functions and
their styles: `statsGrid`, `statTile`, `statLabelRow`, `statLabel`,
`statValue`). Keep the `stats` `useMemo` only if a later step still needs
`stats.spent`/`stats.upcoming` — it doesn't, so delete the `stats` `useMemo`
too, and the now-unused `availablePlans`-driven member-prompt block if it no
longer reads `stats.memberships` (replace `stats.memberships === 0` with a
direct check: `(data?.memberships || []).filter((m) => m.status === "Active").length === 0`).

- [ ] **Step 2: Add a live-now banner**

Add local state and a fetch alongside the existing `usePortalData()` call:

```tsx
const [liveRoom, setLiveRoom] = useState<LiveRoom | null>(null);
useEffect(() => {
  if (!token) return;
  api<{ rooms: LiveRoom[] }>("/api/portal/live", { token }).then((res) => {
    if (res.ok) setLiveRoom(res.data.rooms.find((r) => r.openNow) || null);
  });
}, [token]);
```

Import `api` from `@/lib/api`, `LiveRoom` from `@/types/portal`, and
`token` from the existing `useSession()` destructure (add `token` to it).
Render, right after the hero (or in place of it in event-day mode — see
Step 4), when `liveRoom` is non-null:

```tsx
{liveRoom ? (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${liveRoom.name} is live`}
    onPress={() => router.push(`/live/${liveRoom.id}`)}
    style={styles.liveBanner}
  >
    <View style={styles.liveBannerIcon}>
      <Feather name="radio" size={19} color={colors.success} />
    </View>
    <View style={styles.liveBannerText}>
      <View style={styles.liveBannerTitleRow}>
        <View style={styles.liveBannerDot} />
        <Text style={styles.liveBannerTitle}>{`${liveRoom.name} is live`}</Text>
      </View>
      <Text style={styles.liveBannerSub}>
        {liveRoom.liveNow > 0 ? `${liveRoom.liveNow} watching · ${liveRoom.eventName}` : liveRoom.eventName}
      </Text>
    </View>
    <Feather name="chevron-right" size={18} color={colors.textSecondary} />
  </Pressable>
) : null}
```

Styles (append to `StyleSheet.create`):

```ts
liveBanner: {
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.md,
  borderWidth: 1,
  borderColor: `${colors.success}40`,
  backgroundColor: `${colors.success}14`,
  borderRadius: radius.lg,
  padding: spacing.lg,
},
liveBannerIcon: {
  width: 40,
  height: 40,
  borderRadius: radius.md,
  backgroundColor: `${colors.success}26`,
  alignItems: "center",
  justifyContent: "center",
},
liveBannerText: { flex: 1, minWidth: 0, gap: 3 },
liveBannerTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 3 },
liveBannerDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.success },
liveBannerTitle: { ...type.label, fontWeight: "600", color: colors.foreground },
liveBannerSub: { ...type.caption, color: colors.textSecondary },
```

- [ ] **Step 3: Restyle the hero's countdown/action row to match the mockup**

In `NextEventHero`, change `styles.hero` `borderRadius` to `radius.xxl` (was
`radius.lg`). The countdown + "Show pass" action row already largely matches
the mockup's structure (countdown tiles, then a primary button + icon
buttons); the only functional change: `Button title="View ticket"` becomes
`Button title="Show pass"` with `onPress={() => router.push(\`/tickets/pass/${ticket.id}\`)}`
(the new full-screen route from Task 6) instead of `onOpen` (which opened the
old pushed ticket-detail route, replaced in Task 5).

- [ ] **Step 4: Event-day mode**

Add an `isToday` check next to the existing `nextTicket` memo:

```tsx
const eventIsToday = useMemo(() => {
  if (!nextTicket?.eventDate) return false;
  const d = new Date(nextTicket.eventDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}, [nextTicket]);
```

When `eventIsToday` is true, render `<EventDayCard ticket={nextTicket} />`
instead of `<NextEventHero .../>`, the live banner, and the recent-orders
section (keep the header row as-is). `EventDayCard` is a new function in the
same file:

```tsx
function EventDayCard({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  const collectible = ticket.entitlements?.filter((e) => e.remaining > 0) || [];
  const loc = [ticket.venue, ticket.city].filter(Boolean).join(", ");
  return (
    <View style={styles.eventDayStack}>
      <View style={styles.eventDayCard}>
        <Text style={styles.eventDayEyebrow}>
          {ticket.eventTime ? `Doors open ${ticket.eventTime}` : "Today"}
        </Text>
        <Text style={styles.eventDayTitle}>{ticket.eventName}</Text>
        <Text style={styles.eventDayMeta}>{[ticket.ticket, loc].filter(Boolean).join(" · ")}</Text>
        <View style={styles.eventDayDivider} />
        <View style={styles.eventDayQrRow}>
          <TicketQr orderId={ticket.id} orderCode={ticket.orderCode} compact />
        </View>
        <Button
          title="Open full pass"
          icon="maximize-2"
          onPress={() => router.push(`/tickets/pass/${ticket.id}`)}
          fullWidth
          variant="secondary"
        />
      </View>
      {collectible.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collect at the event"
          onPress={() => router.push(`/tickets/${ticket.id}`)}
          style={styles.eventDayRow}
        >
          <View style={styles.eventDayRowIcon}>
            <Feather name="package" size={18} color={colors.textSecondary} />
          </View>
          <View style={styles.eventDayRowText}>
            <Text style={styles.eventDayRowTitle}>Collect at the event</Text>
            <Text style={styles.eventDayRowSub} numberOfLines={1}>
              {collectible.map((e) => `${e.name} · ${e.collected} of ${e.entitled}`).join(" · ")}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
      {loc ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get directions"
          onPress={() => void openDirections(ticket)}
          style={styles.eventDayRow}
        >
          <View style={styles.eventDayRowIcon}>
            <Feather name="navigation" size={18} color={colors.textSecondary} />
          </View>
          <View style={styles.eventDayRowText}>
            <Text style={styles.eventDayRowTitle}>{loc}</Text>
            <Text style={styles.eventDayRowSub}>Directions</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}
```

This references a `compact` prop on `TicketQr` that doesn't exist yet — add
it in Task 6 (Step 1 there adds `compact?: boolean` to shrink the QR to
104x104 and hide the surrounding chrome when true, matching the mockup's
event-day card). Add styles:

```ts
eventDayStack: { gap: spacing.md },
eventDayCard: {
  backgroundColor: colors.primary,
  borderRadius: radius.xxl,
  padding: spacing.xl,
  gap: spacing.sm,
},
eventDayEyebrow: {
  ...type.caption,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: colors.textSecondary,
},
eventDayTitle: { ...type.title, fontSize: 22, color: colors.primaryForeground },
eventDayMeta: { ...type.body, fontSize: 14, color: colors.textTertiary },
eventDayDivider: { height: 1, marginVertical: spacing.sm, backgroundColor: `${colors.primaryForeground}1f` },
eventDayQrRow: { alignItems: "center", marginBottom: spacing.md },
eventDayRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surfaceSubtle,
  borderRadius: radius.lg,
  padding: spacing.lg,
},
eventDayRowIcon: {
  width: 40,
  height: 40,
  borderRadius: radius.md,
  backgroundColor: colors.surfaceActive,
  alignItems: "center",
  justifyContent: "center",
},
eventDayRowText: { flex: 1, minWidth: 0, gap: 2 },
eventDayRowTitle: { ...type.label, color: colors.foreground },
eventDayRowSub: { ...type.caption, color: colors.textSecondary },
```

Note: `Button`'s `variant` prop already supports a `"secondary"` value per
the structural map — confirm its rendered style reads as dark-on-white
inside the white `eventDayCard` (it should, since `secondary` is the
existing muted/outlined variant); if `Card.tsx`/`Button.tsx` render it with a
transparent background that would vanish on the white card, use
`variant="primary"` instead and confirm visually during Step 5's manual
check — pick whichever reads correctly and note the choice in the commit
message.

- [ ] **Step 5: Typecheck, lint, manual check**

Run: `npx tsc --noEmit && npm run lint` — expected clean.
Manually: temporarily edit a ticket's `eventDate` in a debugger/dev tool (or
just eyeball the non-event-day path since seeding "today" data isn't
available) to confirm both branches render without crashing.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/app/(app)/home/index.tsx
git commit -m "feat(mobile): redesign Home — drop stats grid, add live banner and event-day mode"
```

---

### Task 5: Tickets list restyle + sheet-based detail

**Files:**
- Modify: `mobile/src/components/TicketStub.tsx`
- Modify: `mobile/src/app/(app)/tickets/index.tsx`
- Delete: `mobile/src/app/(app)/tickets/[id].tsx` (superseded by the sheet; its
  logic — cover/QR/countdown/entitlements/refund — moves into the new sheet body)

**Interfaces:**
- Consumes: `RefundSheet` (existing, unchanged props), `TicketQr` (Task 6 adds `compact`).
- Produces: no new exports; `tickets/index.tsx` gains local sheet state
  `const [openTicket, setOpenTicket] = useState<Ticket | null>(null)`.

- [ ] **Step 1: Add a footer-pill variant to `TicketStub`**

Add two optional props to `TicketStubProps`: `countdownLabel?: string` and
`onPass?: () => void`. When both are present, render a footer row below the
existing perforation instead of the current side-stub-only layout — keep the
existing `stub` (price column) but add, to its left, inside a new
`footerRow` `View`, the countdown pill (`Pill`-style but custom since it
needs a `#242424`/tinted-green background matching the mockup, not the
existing `Pill` component's dot+label look) and a "Pass" button
(`Feather name="qr-code"` + text, `Button variant="secondary" size="sm"`) that
calls `onPress={onPass}` with `stopPropagation` so tapping "Pass" doesn't
also trigger the row's own `onPress` (ticket sheet). Concretely, restructure
the returned JSX so `body` + `perforation` stay as today, and `stub` is
replaced by:

```tsx
{countdownLabel && onPass ? (
  <View style={styles.footerRow}>
    <Text style={styles.countdownPill}>{countdownLabel}</Text>
    <Text style={styles.stubValue}>{stubValue}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Show pass"
      onPress={(e) => {
        e.stopPropagation();
        onPass();
      }}
      style={styles.passBtn}
    >
      <Feather name="maximize-2" size={14} color={colors.primaryForeground} />
      <Text style={styles.passBtnText}>Pass</Text>
    </Pressable>
  </View>
) : (
  <View style={styles.stub}>
    <Text style={styles.stubValue} numberOfLines={1}>{stubValue}</Text>
    <Text style={styles.stubLabel}>{stubLabel}</Text>
  </View>
)}
```

(Kept backward-compatible: omitting `countdownLabel`/`onPass` renders the
original side-stub layout, so any other caller of `TicketStub` is
unaffected.) Add styles `footerRow` (row, `alignItems: "center"`, `gap:
spacing.sm`, `paddingHorizontal: spacing.lg`, `paddingVertical: spacing.md`,
`flex: 1`), `countdownPill` (`...type.caption`, `fontWeight: "600"`, `color:
colors.success`, `backgroundColor: ${colors.success}1f`, `borderRadius:
radius.pill`, `paddingHorizontal: spacing.sm`, `paddingVertical: 4`),
`passBtn` (row, `alignItems: center`, `gap: 6`, `backgroundColor:
colors.primary`, `borderRadius: radius.md`, `paddingHorizontal:
spacing.md`, `height: 34`, `marginLeft: "auto"`), `passBtnText`
(`...type.caption`, `fontWeight: "600"`, `color: colors.primaryForeground`).

- [ ] **Step 2: Wire the new footer + sheet state into `tickets/index.tsx`**

In `tickets/index.tsx`, replace any `onPress={() => router.push(\`/tickets/${t.id}\`)}`
on each `TicketStub` with `onPress={() => setOpenTicket(t)}`, and pass
`countdownLabel={countdownLabel(t)} onPass={() => router.push(\`/tickets/pass/${t.id}\`)}`.
Add a helper in the same file:

```ts
function countdownLabel(t: Ticket): string {
  if (!t.eventDate) return "";
  const days = Math.ceil((new Date(t.eventDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Past";
  if (days === 0) return "Today";
  return `In ${days} day${days === 1 ? "" : "s"}`;
}
```

Render the sheet at the bottom of the returned tree:

```tsx
<Sheet visible={!!openTicket} onClose={() => setOpenTicket(null)} title={openTicket?.eventName}>
  {openTicket ? <TicketDetailBody ticket={openTicket} onClose={() => setOpenTicket(null)} /> : null}
</Sheet>
```

- [ ] **Step 3: Write `TicketDetailBody`**

Move the body content of the deleted `tickets/[id].tsx` (cover-less since
sheets don't have a hero image, countdown, calendar/directions action row,
detail rows for When/Where/Organiser/Order, entitlements "Collect at the
event" list, "Message organiser" and "Refund" buttons) into a new function
`TicketDetailBody({ ticket, onClose }: { ticket: Ticket; onClose: () => void })`
in `tickets/index.tsx` (or a new `mobile/src/components/TicketDetailBody.tsx`
if it grows past ~150 lines — split if so, following the "files that change
together live together, split by responsibility" rule). Reuse `DetailRow`,
`Button`, `RefundSheet` exactly as `tickets/[id].tsx` did — this is a move +
restyle, not new logic. "Message organiser" keeps its existing
`router.push({ pathname: "/messages/new", params: { orderId: ticket.id, ... } })`
call (copy verbatim from the deleted file). "Refund" keeps opening the
existing `RefundSheet` (nest its own `visible` state inside
`TicketDetailBody`).

- [ ] **Step 4: Delete the old route and fix references**

Delete `mobile/src/app/(app)/tickets/[id].tsx`. Grep the repo for
`tickets/${` and `"/tickets/"` push calls elsewhere (e.g. `home/index.tsx`'s
`onOpen`, `orders/index.tsx` if it links to a ticket) and repoint them to
either open the sheet (only possible from within `tickets/index.tsx` — other
screens instead push `/tickets/pass/${id}` for a "show pass" action, or
`/tickets` bare for "view tickets") per the design's stated behavior: Home's
"Show pass" already points at the Pass route from Task 4; nothing else in
the app deep-links to `/tickets/:id` per the Task grep — confirm this with:
`grep -rn "tickets/\${" mobile/src --include=*.tsx` and fix any hit found.

- [ ] **Step 5: Typecheck, lint, manual check**

Run: `npx tsc --noEmit && npm run lint`. Manually open Tickets, tap a card
(not its Pass button) to confirm the sheet opens with full detail, tap Pass
to confirm it attempts to navigate to `/tickets/pass/:id` (route added next
task — expect a 404/blank screen until Task 6 lands, that's expected at this
checkpoint).

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/TicketStub.tsx mobile/src/app/(app)/tickets/index.tsx
git rm mobile/src/app/(app)/tickets/\[id\].tsx
git commit -m "feat(mobile): move ticket detail into a bottom sheet, restyle ticket cards"
```

---

### Task 6: Full-screen brightness-boosted Pass screen

**Files:**
- Modify: `mobile/src/components/TicketQr.tsx` (add `compact` prop)
- Create: `mobile/src/app/(app)/tickets/pass/[id].tsx`

**Interfaces:**
- Consumes: `usePortalData().data.tickets` (existing), `expo-brightness` (Task 1).
- Produces: route `/tickets/pass/:id`; `TicketQr` gains `compact?: boolean`.

- [ ] **Step 1: Add `compact` to `TicketQr`**

In `mobile/src/components/TicketQr.tsx`, add `compact?: boolean` to its
props type. When `compact` is true, render the QR at `104` size (vs. the
existing default — check the current default size constant and keep it for
the non-compact case) and omit the surrounding label/border chrome the
component currently draws around the code, leaving just the QR graphic and
the order-code text beneath it at a smaller font size
(`...type.caption` instead of whatever larger style it currently uses for
the code). Keep the default (non-compact) rendering byte-identical to today
for existing callers.

- [ ] **Step 2: Write the Pass screen**

`mobile/src/app/(app)/tickets/pass/[id].tsx`:

```tsx
import { Feather } from "@expo/vector-icons";
import * as Brightness from "expo-brightness";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TicketQr } from "@/components/TicketQr";
import { DetailRow } from "@/components/DetailRow";
import { fmtDateTime, money } from "@/lib/format";
import { usePortalData } from "@/state/data";
import { spacing, type } from "@/theme/tokens";

// Light-mode colors are intentionally hardcoded here, not pulled from
// theme/tokens — this screen deliberately flips to a white door-scan
// surface regardless of the rest of the (dark-only) app.
const LIGHT = { bg: "#ffffff", fg: "#161616", sub: "#525252", chip: "#f3f4f6", border: "#e5e7eb" };

export default function TicketPassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = usePortalData();
  const ticket = (data?.tickets || []).find((t) => t.id === id) || null;

  useEffect(() => {
    let prev: number | null = null;
    (async () => {
      const { status } = await Brightness.getPermissionsAsync();
      if (status !== "granted") await Brightness.requestPermissionsAsync();
      try {
        prev = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(1);
      } catch {
        // Some Android devices refuse app-scoped brightness without
        // WRITE_SETTINGS — the white background still reads as "brightened".
      }
    })();
    return () => {
      if (prev !== null) void Brightness.setBrightnessAsync(prev).catch(() => {});
    };
  }, []);

  if (!ticket) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.dismiss}>
          <Feather name="chevron-down" size={20} color={LIGHT.fg} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.chipBtn}>
          <Feather name="chevron-down" size={20} color={LIGHT.fg} />
        </Pressable>
        <View style={styles.brightPill}>
          <Feather name="sun" size={14} color={LIGHT.sub} />
          <Text style={styles.brightText}>Screen brightened</Text>
        </View>
        <View style={styles.chipBtn} />
      </View>

      <View style={styles.center}>
        <Text style={styles.eyebrow}>Present at entrance</Text>
        <Text style={styles.title}>{ticket.eventName}</Text>
        <Text style={styles.meta}>{[ticket.ticket, ticket.venue].filter(Boolean).join(" · ")}</Text>
      </View>

      <View style={styles.qrWrap}>
        <TicketQr orderId={ticket.id} orderCode={ticket.orderCode} />
      </View>

      <View style={styles.table}>
        <DetailRow label="Attendee" value={ticket.buyerName} />
        <DetailRow
          label="Doors"
          value={[ticket.eventTime, ticket.eventDate ? fmtDateTime(ticket.eventDate) : ""].filter(Boolean).join(" · ")}
        />
        <DetailRow label="Paid" value={money(ticket.total)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LIGHT.bg, paddingHorizontal: spacing.xl },
  dismiss: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56 },
  chipBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: LIGHT.chip, alignItems: "center", justifyContent: "center" },
  brightPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: LIGHT.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brightText: { ...type.label, color: LIGHT.sub },
  center: { alignItems: "center", marginTop: spacing.sm, gap: 6 },
  eyebrow: { ...type.caption, textTransform: "uppercase", letterSpacing: 1.2, color: LIGHT.sub },
  title: { ...type.title, fontSize: 22, color: LIGHT.fg, textAlign: "center" },
  meta: { ...type.body, fontSize: 14, color: LIGHT.sub, textAlign: "center" },
  qrWrap: { alignItems: "center", marginTop: spacing.xl },
  table: {
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: LIGHT.border,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
});
```

`DetailRow`'s existing styling pulls from `theme/tokens` colors (dark) — check
its implementation; if it hardcodes `colors.foreground`/`colors.textSecondary`
internally it will render dark-on-white incorrectly here (dark text is
actually what's wanted on a white background, so this is likely fine as-is —
verify visually in Step 4 and only patch `DetailRow` if it renders light text
that disappears on white).

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Manual check**

From Tickets, tap a card's "Pass" button (or Home's "Show pass" in event-day
mode). Confirm: screen goes full white, brightness visibly increases on a
real device (Expo Go brightness API works on real hardware, not always in
simulators — note in the report if only simulator-tested), QR + order code +
attendee/doors/paid rows render, back chevron restores brightness and pops
the route.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/TicketQr.tsx "mobile/src/app/(app)/tickets/pass/[id].tsx"
git commit -m "feat(mobile): add full-screen brightness-boosted ticket pass"
```

---

### Task 7: Live tab restyle (featured room + schedule)

**Files:**
- Modify: `mobile/src/app/(app)/live/index.tsx`
- Modify: `mobile/src/state/data.tsx` (add a `live` count)

**Interfaces:**
- Produces: `usePortalData().counts.live: number` (1 if any room is
  `openNow`, else 0) — consumed by `TabBar`'s live-dot badge (Task 3, Step 2's
  deferred `0`).
- Consumes: `useLivePlayer().dock` is NOT called here (only the room screen,
  Task 8, calls `dock`) — this screen only lists rooms.

- [ ] **Step 1: Add the `live` count to `PortalDataProvider`**

`state/data.tsx` doesn't currently fetch `/api/portal/live` (only
`live/index.tsx` does, via its own poll). Rather than duplicate polling in
the provider, compute `counts.live` lazily: add a `liveOpen: boolean` piece
of state to `PortalDataProvider`, exposed as `setLiveOpen(open: boolean)` in
the context value, and have `live/index.tsx` call it whenever its own poll
resolves (`setLiveOpen(rooms.some(r => r.openNow))`). Add to the context
type: `counts.live: liveOpen ? 1 : 0` alongside the existing count fields,
and `setLiveOpen(open: boolean): void` as a top-level export of the hook's
return value.

- [ ] **Step 2: Call `setLiveOpen` from the Live screen's poll**

In `live/index.tsx`'s `load` callback (the one already polling
`/api/portal/live` every 30s), after `setRooms(...)`, add:
`setLiveOpen(res.ok ? res.data.rooms.some((r) => r.openNow) : false);` —
pull `setLiveOpen` from `usePortalData()`.

- [ ] **Step 3: Restyle into featured + schedule sections**

Split `rooms` (already fetched) into `const live = rooms?.filter(r =>
r.openNow) || []` and `const upcoming = rooms?.filter(r => !r.openNow) ||
[]`. Render, when `live.length`, a `FeaturedRoomCard` for `live[0]` (any
additional simultaneous live rooms render as regular `RoomCard`s below it —
uncommon but handled, not silently dropped) with: 16:9 placeholder using
`EventCover` (reuse, it already renders a gradient+initial fallback when
there's no image — there's no room-level cover URL in `LiveRoom`, so pass
`name={room.name}` with no `uri`), a `LIVE` pill, `liveNow` watcher count,
title, `eventName`, and a full-width "Join room" `Button` (`icon="radio"`)
that calls `router.push(\`/live/${room.id}\`)`. Render `upcoming` as a plain
list of `ListRow`s: leading = time block (`Text` with the hour/minute large,
AM/PM small — two stacked `Text`s in a narrow `View`), title + "Opens in Xm"
or formatted date subtitle (reuse `fmtDateTime`/countdown math already
available via `Countdown`'s underlying `useCountdown` hook — or simpler,
reuse the existing `room.startsAt` branch logic already in the current
`RoomCard`, just re-laid-out). Keep the existing `RoundRail` usage for any
`parentSessionId` room, rendered inside its list row (expand-on-tap or
always-visible — keep always-visible, matching current behavior, to avoid
scope creep on interaction design not specified by the mockup for this list
view).

- [ ] **Step 4: Wire the live count into the tab-bar dot**

In `mobile/src/components/TabBar.tsx`, update the `live` entry in
`BADGE_ROUTES` (added in Task 3 Step 2 as a literal `0` placeholder) to read
the real count: `live: (c) => c.live || 0`. This is the only spot Task 3's
file needs revisiting, and only because `counts.live` didn't exist until
this task's Step 1.

- [ ] **Step 5: Typecheck, lint, manual check**

Run: `npx tsc --noEmit && npm run lint`. Manually confirm Live tab renders
correctly with 0 rooms (existing `EmptyState`, unchanged), with only
upcoming rooms, and — if a live room is available in test data — the
featured card layout and the tab bar's live dot.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/app/(app)/live/index.tsx mobile/src/state/data.tsx mobile/src/components/TabBar.tsx
git commit -m "feat(mobile): restyle Live tab into a featured room + schedule list"
```

---

### Task 8: Live room screen restyle + dock wiring

**Files:**
- Modify: `mobile/src/app/(app)/live/[id].tsx`

**Interfaces:**
- Consumes: `useLivePlayer().dock`/`.clear` (Task 2).

- [ ] **Step 1: Call `dock` on mount, `clear` on leaving the room voluntarily**

In `LiveRoomScreen`, once `room` loads successfully, call
`dock({ id: room.id, name: room.name, eventName: room.eventName })` from
`useLivePlayer()` in a `useEffect` keyed on `room?.id`. Do NOT call `clear()`
on unmount — that's what makes the bar "dock" when the member navigates away
via the tab bar; `clear()` is only called by the docked bar's own `x` button
(Task 2) or, on this screen, by an explicit "Leave room" affordance (Step 2).

- [ ] **Step 2: Restyle to header-overlaid controls + stat tiles + host card**

Wrap the existing `RoomPlayer` in a `View` with the video as
`StyleSheet.absoluteFill` background and an overlay row (`chevron-down` to
go back — this is the "minimize" action per the design, so it should just
`router.back()`, letting the dock pick it up since `dock` already fired and
isn't cleared; a `LIVE · {liveNow}` pill; a `maximize` button that's a no-op
placeholder calling nothing extra since `expo-video`'s `nativeControls`
already exposes native fullscreen — remove the custom maximize icon if
`nativeControls` already covers it, to avoid a dead button). Below the
video: room title, `eventName · with {speaker}` if a speaker field exists on
`LiveRoom` (it doesn't per `types/portal.ts` — omit the "with X" clause,
just render `eventName`). Two stat tiles side by side (`View` with `flex:
1` each): round clock (reuse `RoundRail`'s countdown value — check whether
`RoundRail` exposes the raw seconds-remaining or only renders its own chip;
if it only renders, keep using `<RoundRail parentSessionId={...} />` as a
self-contained widget inside one of the two tiles rather than re-deriving
its internal math) and participant count (`room.liveNow`, icon `users`).
"From the host" broadcasts: if `RoundRail`'s existing component already
renders host broadcast strip content, extract that sub-piece into its own
small styled card matching the mockup ("From the host" eyebrow with a
`megaphone` icon + the broadcast text list) — read `RoundRail.tsx`'s current
implementation first to know whether this is a prop-level change (e.g.
`<RoundRail parentSessionId={id} variant="host-card" />`) or a full extraction
into a new sub-component; pick whichever requires less duplication given
what's actually in that file, and note the choice in the commit message.

- [ ] **Step 3: Typecheck, lint, manual check**

Run: `npx tsc --noEmit && npm run lint`. Manually: open a room, confirm video
plays, back out via the tab bar, confirm the docked bar (Task 2) appears and
tapping it returns to the room; confirm the docked bar's `x` stops the
heartbeat (its `clear()` call).

- [ ] **Step 4: Commit**

```bash
git add "mobile/src/app/(app)/live/[id].tsx"
git commit -m "feat(mobile): restyle live room screen and wire the docked mini-player"
```

---

### Task 9: Inbox screen (aggregated Messages/Notifications/Community/Q&A)

**Files:**
- Modify: `mobile/src/app/(app)/inbox/index.tsx` (replaces the Task 3 stub)
- Create: `mobile/src/components/InboxRow.tsx`

**Interfaces:**
- Consumes: `usePortalData().threads/notifications` (existing),
  `api<{ channels: Channel[] }>("/api/portal/chat/channels?kind=event"|"qa", { token })`
  (same call shape `ChannelList.tsx` already makes — read that file's exact
  query/response handling and mirror it, don't invent a new shape).
- Produces: no new exports beyond the route component and `InboxRow`.

- [ ] **Step 1: Define the merged row type**

In `inbox/index.tsx`:

```ts
type InboxKind = "thread" | "notification" | "channel" | "qa";
type InboxItem = {
  id: string;
  kind: InboxKind;
  title: string;
  preview: string;
  timestamp: string | null;
  unread: boolean;
  unreadCount?: number;
  meta?: string; // order-code pill text, "84 members", etc.
  announceOnly?: boolean;
  href: string;
};
```

- [ ] **Step 2: Fetch and map all four sources**

```tsx
const { threads, notifications } = usePortalData();
const { token } = useSession();
const [channels, setChannels] = useState<Channel[] | null>(null);
const [qaChannels, setQaChannels] = useState<Channel[] | null>(null);

useEffect(() => {
  if (!token) return;
  api<{ channels: Channel[] }>("/api/portal/chat/channels?kind=event", { token }).then(
    (res) => setChannels(res.ok ? res.data.channels : []),
  );
  api<{ channels: Channel[] }>("/api/portal/chat/channels?kind=qa", { token }).then(
    (res) => setQaChannels(res.ok ? res.data.channels : []),
  );
}, [token]);

const items = useMemo<InboxItem[]>(() => {
  const fromThreads: InboxItem[] = (threads || []).map((t) => ({
    id: `thread-${t.id}`,
    kind: "thread",
    title: t.subject || "Organiser",
    preview: t.preview,
    timestamp: t.lastMessageAt,
    unread: t.unread,
    meta: t.orderId ? "Order" : undefined,
    href: `/messages/${t.id}`,
  }));
  const fromNotifications: InboxItem[] = (notifications.items || []).map((n) => ({
    id: `notif-${n.id}`,
    kind: "notification",
    title: n.title,
    preview: n.body,
    timestamp: n.createdAt,
    unread: n.unread,
    href: "/notifications",
  }));
  const fromChannels: InboxItem[] = (channels || []).map((c) => ({
    id: `channel-${c.id}`,
    kind: "channel",
    title: c.name,
    preview: c.lastPreview,
    timestamp: c.lastMessageAt,
    unread: c.unread > 0,
    unreadCount: c.unread,
    meta: `${c.participantCount} members`,
    announceOnly: c.postingMode === "announce",
    href: `/community/${c.id}`,
  }));
  const fromQa: InboxItem[] = (qaChannels || []).map((c) => ({
    id: `qa-${c.id}`,
    kind: "qa",
    title: c.name,
    preview: c.lastPreview,
    timestamp: c.lastMessageAt,
    unread: c.unread > 0,
    unreadCount: c.unread,
    href: `/qa/${c.id}`,
  }));
  return [...fromThreads, ...fromNotifications, ...fromChannels, ...fromQa].sort(
    (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
  );
}, [threads, notifications, channels, qaChannels]);
```

(Verify `Thread`, `NotificationItem`, `Channel` field names against
`types/portal.ts` exactly as already quoted in the structural map — they
match 1:1 above.)

- [ ] **Step 3: Filter chips**

```tsx
const [filter, setFilter] = useState<"all" | "organiser" | "updates" | "chats">("all");
const counts = useMemo(
  () => ({
    all: items.length,
    organiser: items.filter((i) => i.kind === "thread").length,
    updates: items.filter((i) => i.kind === "notification").length,
    chats: items.filter((i) => i.kind === "channel" || i.kind === "qa").length,
  }),
  [items],
);
const filtered = useMemo(() => {
  if (filter === "all") return items;
  if (filter === "organiser") return items.filter((i) => i.kind === "thread");
  if (filter === "updates") return items.filter((i) => i.kind === "notification");
  return items.filter((i) => i.kind === "channel" || i.kind === "qa");
}, [items, filter]);
```

Render four chip `Pressable`s (reuse the visual pattern from `Segmented` if
it supports >2 options and a count suffix; if it doesn't, write a small
inline row of pill `Pressable`s styled like `Pill` but selectable — check
`Segmented.tsx`'s API before deciding; if it only supports a fixed 2-value
toggle, don't force it — write the 4-chip row directly here since it's
screen-specific, not a new shared primitive worth generalizing for one use).

- [ ] **Step 4: `InboxRow` component**

`mobile/src/components/InboxRow.tsx` — one row, branching purely on
`item.kind`/`item.announceOnly` for avatar style and trailing pill, per the
design doc's "richest single list-row component" note:

```tsx
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { fmtTimeAgo } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { InboxKind } from "@/app/(app)/inbox";

type Props = {
  kind: InboxKind;
  title: string;
  preview: string;
  timestamp: string | null;
  unread: boolean;
  unreadCount?: number;
  meta?: string;
  announceOnly?: boolean;
  onPress: () => void;
};

export function InboxRow({ kind, title, preview, timestamp, unread, unreadCount, meta, announceOnly, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {kind === "notification" ? (
        <View style={styles.iconAvatar}>
          <Feather name="megaphone" size={17} color={colors.textSecondary} />
        </View>
      ) : (
        <Avatar name={title} size={44} />
      )}
      <View style={styles.textStack}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
            {title}
          </Text>
          {timestamp ? <Text style={styles.time}>{fmtTimeAgo(timestamp)}</Text> : null}
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {preview}
        </Text>
        {meta || announceOnly ? (
          <View style={styles.pillRow}>
            {announceOnly ? (
              <View style={[styles.pill, styles.pillInfo]}>
                <Feather name="megaphone" size={11} color={colors.info} />
                <Text style={[styles.pillText, { color: colors.info }]}>Announce only</Text>
              </View>
            ) : meta ? (
              <View style={[styles.pill, styles.pillSuccess]}>
                <Feather name="users" size={11} color={colors.success} />
                <Text style={[styles.pillText, { color: colors.success }]}>{meta}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {unread ? (
        unreadCount ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{unreadCount}</Text>
          </View>
        ) : (
          <View style={styles.dot} />
        )
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.md },
  pressed: { opacity: 0.7 },
  iconAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceActive,
    alignItems: "center", justifyContent: "center",
  },
  textStack: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...type.label, flex: 1, color: colors.textSecondary },
  titleUnread: { fontWeight: "600", color: colors.foreground },
  time: { ...type.caption, color: colors.textTertiary },
  preview: { ...type.caption, color: colors.textSecondary },
  pillRow: { flexDirection: "row", marginTop: 2 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  pillSuccess: { backgroundColor: `${colors.success}1f` },
  pillInfo: { backgroundColor: `${colors.info}1f` },
  pillText: { ...type.caption, fontWeight: "600" },
  countBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
  },
  countBadgeText: { ...type.caption, fontWeight: "700", color: colors.primaryForeground },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.primary },
});
```

Export `InboxKind` from `inbox/index.tsx` (move the type there if it's only
consumed by `InboxRow`, or hoist it to `types/portal.ts`-adjacent local types
if it feels more at home there — keep it in `inbox/index.tsx` since it's a
screen-local aggregation concept, not a server view model, and adjust the
`InboxRow` import path accordingly, e.g. `import type { InboxKind } from
"@/app/(app)/inbox"` may not resolve depending on expo-router's route
module exports — if it doesn't, define `InboxKind` directly in
`InboxRow.tsx` instead and have `inbox/index.tsx` import it from there
(component owns the type it renders on, which is the more conventional
direction — prefer this if the route-module import proves awkward).

- [ ] **Step 5: Assemble the screen**

Render `ScreenHeader title="Inbox"` with a compose button
(`router.push("/messages/new")`) in its `right` slot, the 4-chip filter row,
then loading (skeleton, while all four sources are still `null`), empty
(`EmptyState`, no items at all), filtered-empty ("no results for this
filter" `EmptyState` variant), or the `filtered.map` list of `InboxRow`s
wired to `router.push(item.href)`.

- [ ] **Step 6: Typecheck, lint, manual check**

Run: `npx tsc --noEmit && npm run lint`. Manually open Inbox, confirm all
four row kinds you have test data for render distinctly, filters narrow the
list, tapping a row navigates to the right existing detail screen.

- [ ] **Step 7: Commit**

```bash
git add "mobile/src/app/(app)/inbox/index.tsx" mobile/src/components/InboxRow.tsx
git commit -m "feat(mobile): build the Inbox tab — merges threads, notifications, channels, Q&A"
```

---

### Task 10: More screen restructure

**Files:**
- Modify: `mobile/src/app/(app)/more/index.tsx`

- [ ] **Step 1: Regroup into three card sections**

Replace the current four `SectionTitle`+`Card` groups ("Purchases",
"Community", "Updates", "Account") with three, matching the design doc:

Group 1 — content shortcuts (`SectionTitle`: none needed, or reuse "Your
stuff" as a concise header): rows for Memberships (trailing = active plan
name if any, else nothing), "Orders & receipts" (trailing count =
`counts.orders`), "Watch library" (new row, trailing count = `counts.watch`,
`onPress={() => router.push("/watch")}`), "Q&A threads" (trailing none,
`onPress={() => router.push("/qa")}`).

Group 2 — app settings: keep only "Push notifications" as a `Switch`-based
row (reuse whatever toggle pattern `account/index.tsx` already uses for its
push-notification opt-in, since that's the existing source of truth for the
toggle's on/off state and persistence — don't duplicate the state, just
surface a second entry point to the same control, or better, remove the
duplicate from `account/index.tsx` if More becomes the single home for it;
decide based on which file currently owns the actual registration call in
`lib/push.ts` and keep it there, having the other screen (if any) link to
this one instead of duplicating the switch).

Group 3 — account/security: "Account" row (unchanged, → `/account`), "Sign
out" (unchanged, existing confirm `Sheet`).

Remove the old "Community" (Q&A/Messages) and "Updates" (Notifications)
groups entirely — those are now reached via the Inbox tab; Q&A keeps a
direct link only because the mockup explicitly keeps a standalone Q&A list
reachable from More (per the design doc).

- [ ] **Step 2: Typecheck, lint, manual check**

Run: `npx tsc --noEmit && npm run lint`. Manually confirm all links resolve
(Memberships, Orders, Watch library, Q&A, Account) and the push-notifications
toggle still reflects/updates real state.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/(app)/more/index.tsx
git commit -m "feat(mobile): restructure More into content/settings/account groups"
```

---

### Task 11: Account screen restyle

**Files:**
- Modify: `mobile/src/app/(app)/account/index.tsx`

- [ ] **Step 1: Regroup into profile / security / danger-zone cards**

Restructure the existing fields (no new data, no avatar upload, no device
list — per the design doc's scope-out) into three `Card`-bordered groups:
profile (`Avatar` initials chip + name, editable name/phone fields, disabled
email row — reuse whatever "disabled row" visual treatment is closest to the
mockup's greyed-out row, e.g. `Card` with reduced opacity or
`colors.surfaceActive` background and non-interactive `Text` instead of an
`Input`), security ("Change password" row → existing
`account/change-password` route, "Sign out of all devices" action — reuse
the existing `signOutEverywhere` call), danger zone ("Sign out" — the
existing local sign-out confirm sheet, kept as today). If the app currently
has an inline "push notifications" toggle here AND Task 10 also gave it a
home in More, remove it from whichever screen doesn't own the underlying
`lib/push.ts` registration call (see Task 10 Step 1's note) so it isn't
edited in two places.

- [ ] **Step 2: Typecheck, lint, manual check**

Run: `npx tsc --noEmit && npm run lint`. Manually confirm profile edits still
save (`POST /api/portal/profile`, unchanged), change-password link works,
both sign-out actions still function.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/(app)/account/index.tsx
git commit -m "feat(mobile): restyle Account into profile/security/danger-zone groups"
```

---

### Task 12: Full-app verification pass

**Files:** none created/modified beyond incidental fixes found during this pass.

- [ ] **Step 1: Full typecheck and lint**

Run: `npx tsc --noEmit && npm run lint` from `mobile/`.
Expected: zero errors, zero warnings introduced by this redesign.

- [ ] **Step 2: Grep for orphaned references**

Run: `grep -rn "watch/index\|community/index\|qa/index\|/messages\"\|/notifications\"" mobile/src --include=*.tsx`
and manually confirm every remaining hit is an intentional deep link (e.g.
More → Q&A, Inbox rows → `/community/:id`), not a leftover reference to a
tab that no longer exists.

- [ ] **Step 3: Full manual click-through**

Using `npx expo start` + Expo Go or a dev client: sign in → Home (confirm
live banner appears/disappears correctly, hero "Show pass" opens the Pass
screen) → Tickets (open a card's sheet, open Pass from the sheet and from
the card's own Pass button) → Live (featured card if something's live,
schedule list, open a room, back out via tab bar and confirm the docked bar
appears and works) → Inbox (all four chip filters, open one item of each
kind) → More (every row navigates) → Account (edit + save a field).

- [ ] **Step 4: Commit any fixes found**

```bash
git add -A
git commit -m "fix(mobile): clean up references found during the redesign verification pass"
```

(Skip this commit if Steps 1-3 found nothing to fix.)

---

### Task 13: EAS preview build

**Files:** none.

- [ ] **Step 1: Confirm EAS auth and project link**

Run (from `mobile/`): `npx eas-cli whoami`
Expected: `bhargavjoshi1237@gmail.com` (already confirmed logged in).

- [ ] **Step 2: Kick off the preview build**

Run: `npx eas-cli build --profile preview --platform android --non-interactive`
This uses the existing `eas.json` `preview` profile (`buildType: apk`,
`EXPO_PUBLIC_API_BASE_URL` already set to the production portal URL).

- [ ] **Step 3: Report the build**

Once the command returns (or the dashboard shows it queued/building), report
the build URL back so the APK can be downloaded once it finishes — EAS
builds run on Expo's infra and typically take several minutes; don't block
other work waiting on it if it's slow.

---

## Self-Review Notes

- **Spec coverage:** every design-doc section (nav shell, Home, Tickets +
  Pass, Live + docked player, Inbox, More, Account, dependency, verification,
  build) maps to a task above.
- **Scope-outs preserved:** no task adds light theme, wallet passes, avatar
  upload, or in-room chat — Tasks 4, 6, 9, 11 explicitly note why those
  pieces are omitted where the mockup might otherwise suggest them.
- **Type/name consistency:** `InboxItem`/`InboxKind` defined once (Task 9)
  and reused by `InboxRow` (same task); `LivePlayerState`/`useLivePlayer`
  defined in Task 2 and consumed unchanged by Tasks 3, 7, 8; `counts.live`
  defined in Task 7 Step 1, with Task 3 Step 2 landing a literal `0`
  placeholder in `TabBar.tsx`'s `BADGE_ROUTES` and Task 7 Step 4 explicitly
  revisiting that same line to read the real count once it exists.
