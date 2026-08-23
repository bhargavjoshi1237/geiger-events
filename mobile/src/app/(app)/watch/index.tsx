import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { EventCover } from "@/components/EventCover";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDateTime } from "@/lib/format";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { WatchItem } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;
const LEAVING_DAYS = 7;

// Now-based checks live in helpers so the compiler doesn't flag them as impure
// render calls (same pattern as fmtTimeAgo).
function notYetPremiered(premiereAt: string | null): boolean {
  return !!premiereAt && new Date(premiereAt).getTime() > Date.now();
}

function leavingDays(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 864e5);
}

export default function WatchScreen() {
  const router = useRouter();
  const { watch, loading, refreshing, refreshAll } = usePortalData();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return watch || [];
    return (watch || []).filter((i) =>
      `${i.name} ${i.session} ${i.speaker} ${i.eventName} ${i.tags.join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [watch, search]);

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll}>
      <View style={styles.head}>
        <Text style={styles.title}>Watch</Text>
        <Text style={styles.subtitle}>
          Recordings and replays your memberships unlock — watch any time until your access ends.
        </Text>
      </View>

      {loading.watch ? (
        <SkeletonList rows={4} />
      ) : watch?.length ? (
        <>
          <Input
            leftIcon="search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search recordings, sessions, speakers…"
          />
          {filtered.length ? (
            <Animated.View layout={LinearTransition} style={styles.list}>
              {filtered.map((item, idx) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.delay(stagger(idx)).springify()}
                  layout={LinearTransition}
                >
                  <WatchCard
                    item={item}
                    onOpen={() => router.push(`/watch/${item.id}`)}
                  />
                </Animated.View>
              ))}
            </Animated.View>
          ) : (
            <EmptyState icon="search" title="No matches" message="Try a different search." />
          )}
        </>
      ) : (
        <EmptyState
          icon="play-circle"
          title="Nothing to watch yet"
          message="Recordings your memberships unlock will appear here."
        />
      )}
    </Screen>
  );
}

function WatchCard({ item, onOpen }: { item: WatchItem; onOpen: () => void }) {
  // A simulive that hasn't premiered is locked until its premiere time.
  const premiere = item.kind === "simulive" && notYetPremiered(item.premiereAt);
  const days = leavingDays(item.expiresAt);
  const leaving = days !== null && days > 0 && days <= LEAVING_DAYS;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={{ disabled: premiere }}
      disabled={premiere}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, premiere && styles.cardLocked, pressed && styles.pressed]}
    >
      <View style={styles.coverWrap}>
        <EventCover uri={item.thumbnailUrl} name={item.name} height={160} />
        <LinearGradient
          colors={[colors.overlay, "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Frosted disc reads as a button; the bare icon didn't. */}
        <View style={styles.playWrap} pointerEvents="none">
          <View style={styles.playDisc}>
            <Feather
              name={premiere ? "clock" : "play"}
              size={22}
              color={colors.primary}
              style={!premiere ? styles.playGlyph : undefined}
            />
          </View>
        </View>
        {item.duration && !premiere ? (
          <View style={styles.duration}>
            <Text style={styles.durationText}>{item.duration}</Text>
          </View>
        ) : null}
        {premiere ? (
          <View style={styles.premiereChip}>
            <Text style={styles.premiereChipText}>Premieres {fmtDateTime(item.premiereAt)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[item.speaker, item.session, item.eventName].filter(Boolean).join(" · ")}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.included} numberOfLines={1}>
            Included with {item.planName}
          </Text>
          {!premiere && leaving ? (
            <Pill
              label={`Leaves in ${days} ${days === 1 ? "day" : "days"}`}
              tone="warning"
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  title: {
    ...type.display,
    color: colors.foreground,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
  },
  cardLocked: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.8,
  },
  coverWrap: {
    position: "relative",
  },
  playWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  playDisc: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.chipScrim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  // Nudge the play glyph right so it optically centres inside the disc.
  playGlyph: {
    marginLeft: 3,
  },
  duration: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.chipScrim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm + 2,
  },
  durationText: {
    ...type.caption,
    fontSize: 10,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  premiereChip: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: `${colors.warning}26`,
    borderWidth: 1,
    borderColor: `${colors.warning}4D`,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm + 2,
  },
  premiereChipText: {
    ...type.caption,
    fontSize: 10,
    color: colors.warning,
    fontVariant: ["tabular-nums"],
  },
  body: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  name: {
    ...type.body,
    fontWeight: "600",
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  included: {
    flex: 1,
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
