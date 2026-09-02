import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { Icon } from "@/components/ui/icons";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { PulseDot } from "@/components/ui/PulseDot";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDate, fmtClock, isToday } from "@/lib/format";
import { usePoll } from "@/lib/use_poll";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { LiveRoom } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;
const POLL_MS = 30_000;
const SOON_SECONDS = 3600;

function countdownLabel(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `Opens in ${mins}m`;
  const hours = Math.floor(mins / 60);
  return `Opens in ${hours}h ${mins % 60}m`;
}

export default function LiveScreen() {
  const router = useRouter();
  const { live, loading, refreshLive } = usePortalData();

  usePoll(refreshLive, POLL_MS, true);

  const { now, next } = useMemo(() => {
    const rooms = live || [];
    return {
      now: rooms.filter((r) => r.openNow),
      next: rooms
        .filter((r) => !r.openNow)
        .sort(
          (a, b) =>
            new Date(a.startsAt || 0).getTime() - new Date(b.startsAt || 0).getTime(),
        ),
    };
  }, [live]);

  const first = now[0] || null;

  return (
    <Screen scroll>
      <ScreenTitle
        title="Live"
        right={
          now.length ? (
            <View style={styles.liveNowPill}>
              <PulseDot size={7} />
              <Text style={styles.liveNowText}>
                {now.length} live now
              </Text>
            </View>
          ) : null
        }
      />

      {live === null && loading.live ? (
        <SkeletonList rows={3} />
      ) : !live?.length ? (
        <EmptyState
          icon="radio"
          title="Nothing live"
          message="Rooms, webinars and breakouts you have access to open here."
        />
      ) : (
        <Animated.View layout={LinearTransition} style={styles.stack}>
          {first ? (
            <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
              <FeaturedRoom room={first} onOpen={() => router.push(`/live/${first.id}`)} />
            </Animated.View>
          ) : null}

          {now.slice(1).length ? (
            <View>
              <SectionTitle>Also live</SectionTitle>
              <View style={styles.rows}>
                {now.slice(1).map((room, idx) => (
                  <Animated.View
                    key={room.id}
                    entering={FadeInDown.delay(stagger(idx + 1)).springify()}
                  >
                    <UpcomingRow room={room} onPress={() => router.push(`/live/${room.id}`)} live />
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}

          {next.length ? (
            <View>
              <SectionTitle>Coming up</SectionTitle>
              <View style={styles.rows}>
                {next.map((room, idx) => (
                  <Animated.View
                    key={room.id}
                    entering={FadeInDown.delay(stagger(idx)).springify()}
                    layout={LinearTransition}
                  >
                    <UpcomingRow room={room} onPress={() => router.push(`/live/${room.id}`)} />
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}
        </Animated.View>
      )}
    </Screen>
  );
}

function FeaturedRoom({ room, onOpen }: { room: LiveRoom; onOpen: () => void }) {
  const canWatch = Boolean(room.watchUrl);
  const meta = [room.eventName, room.planName].filter(Boolean).join(" · ");

  return (
    <View style={styles.featured}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${room.name}`}
        onPress={onOpen}
        style={styles.poster}
      >
        <LinearGradient
          colors={[colors.avatarGradientStart, colors.avatarGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.playDisc}>
          <Icon name="play" size={26} color={colors.paperForeground} style={styles.playGlyph} />
        </View>
        <View style={styles.liveChip}>
          <PulseDot size={6} />
          <Text style={styles.liveChipText}>LIVE</Text>
        </View>
        {room.liveNow > 0 ? (
          <View style={styles.watchingChip}>
            <Text style={styles.watchingText}>{room.liveNow} watching</Text>
          </View>
        ) : null}
      </Pressable>
      <View style={styles.featuredBody}>
        <Text style={styles.featuredName} numberOfLines={2}>
          {room.name}
        </Text>
        {meta ? (
          <Text style={styles.featuredMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <View style={styles.featuredAction}>
          {canWatch ? (
            <Button title="Join room" icon="radio" onPress={onOpen} fullWidth />
          ) : room.joinUrl ? (
            <Button
              title="Join room"
              icon="external-link"
              onPress={() => void WebBrowser.openBrowserAsync(room.joinUrl)}
              fullWidth
            />
          ) : (
            <Button title="Opens soon" disabled fullWidth />
          )}
        </View>
      </View>
    </View>
  );
}

function UpcomingRow({
  room,
  onPress,
  live = false,
}: {
  room: LiveRoom;
  onPress: () => void;
  live?: boolean;
}) {
  const soon =
    !live && room.secondsUntilStart !== null && room.secondsUntilStart <= SOON_SECONDS;
  // Some locales separate the meridiem with a narrow no-break space, so split on any whitespace.
  const clock = room.startsAt ? fmtClock(room.startsAt) : "";
  const [time, suffix] = clock.split(/\s+/);
  const sub = live
    ? [room.liveNow > 0 ? `${room.liveNow} watching` : null, room.eventName]
        .filter(Boolean)
        .join(" · ")
    : [
        countdownLabel(room.secondsUntilStart) ||
          (room.startsAt && !isToday(room.startsAt) ? fmtDate(room.startsAt) : room.state),
        room.eventName,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${room.name}, ${sub}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !live && !soon && styles.rowDim, pressed && styles.pressed]}
    >
      <View style={styles.timeCol}>
        <Text style={styles.time}>{time || "—"}</Text>
        {suffix ? <Text style={styles.timeSuffix}>{suffix}</Text> : null}
      </View>
      <View style={styles.rowDivider} />
      <View style={styles.rowStack}>
        <Text style={styles.rowName} numberOfLines={1}>
          {room.name}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {live ? (
        <PulseDot size={8} />
      ) : soon ? (
        <Pill label="Soon" tone="warning" dot={false} />
      ) : (
        <Icon name="chevron-right" size={18} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },
  liveNowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: `${colors.success}40`,
    backgroundColor: `${colors.success}1A`,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
  },
  liveNowText: {
    ...type.micro,
    color: colors.success,
  },
  featured: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl - 2,
    backgroundColor: colors.surfaceSubtle,
  },
  poster: {
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceActive,
  },
  playDisc: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  playGlyph: {
    marginLeft: 4,
  },
  liveChip: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.sm - 2,
    backgroundColor: colors.scrim,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
  },
  liveChipText: {
    ...type.kicker,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.primary,
  },
  watchingChip: {
    position: "absolute",
    bottom: spacing.md,
    right: spacing.md,
    borderRadius: radius.sm - 2,
    backgroundColor: colors.scrim,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  watchingText: {
    ...type.micro,
    fontSize: 11,
    color: colors.primary,
  },
  featuredBody: {
    padding: spacing.lg,
    gap: 6,
  },
  featuredName: {
    ...type.bodyStrong,
    fontSize: 16,
    lineHeight: 20,
    color: colors.foreground,
  },
  featuredMeta: {
    ...type.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  featuredAction: {
    marginTop: spacing.sm,
  },
  rows: {
    gap: spacing.md - 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  rowDim: {
    opacity: 0.75,
  },
  timeCol: {
    width: 52,
    alignItems: "center",
  },
  time: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  timeSuffix: {
    ...type.caption,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginTop: 4,
  },
  rowDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: colors.surfaceHover,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowName: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  rowSub: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
