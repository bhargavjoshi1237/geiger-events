import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { Icon } from "@/components/ui/icons";
import { EventCover } from "@/components/EventCover";
import { ScreenTitle } from "@/components/ScreenTitle";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDate, fmtDateTime, pluralize } from "@/lib/format";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { WatchItem } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;
const LEAVING_DAYS = 14;

function notYetPremiered(premiereAt: string | null): boolean {
  return !!premiereAt && new Date(premiereAt).getTime() > Date.now();
}

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 864e5);
}

function accessLine(item: WatchItem): { label: string; leaving: boolean } {
  const days = daysLeft(item.expiresAt);
  if (days === null) return { label: "Permanent access", leaving: false };
  if (days <= 0) return { label: "Access ended", leaving: true };
  return { label: `Access until ${fmtDate(item.expiresAt)}`, leaving: days <= LEAVING_DAYS };
}

export default function WatchScreen() {
  const router = useRouter();
  const { watch, loading } = usePortalData();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return watch || [];
    return (watch || []).filter((i) =>
      `${i.name} ${i.session} ${i.speaker} ${i.eventName} ${i.tags.join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [watch, query]);

  const [featured, ...rest] = filtered;

  const groups = useMemo(() => {
    const byPlan = new Map<string, WatchItem[]>();
    for (const item of rest) {
      const key = item.planName || "Your library";
      const list = byPlan.get(key);
      if (list) list.push(item);
      else byPlan.set(key, [item]);
    }
    return [...byPlan.entries()];
  }, [rest]);

  return (
    <Screen scroll>
      <ScreenHeaderRow
        searching={searching}
        onToggle={() => {
          setSearching((s) => !s);
          setQuery("");
        }}
      />

      {searching ? (
        <View style={styles.search}>
          <Input
            leftIcon="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search recordings, sessions, speakers…"
            autoCapitalize="none"
            autoFocus
          />
        </View>
      ) : null}

      {loading.watch && watch === null ? (
        <SkeletonList rows={4} />
      ) : !watch?.length ? (
        <EmptyState
          icon="circle-play"
          title="Nothing to watch yet"
          message="Recordings your memberships and tickets unlock will appear here."
          actionLabel="See memberships"
          onAction={() => router.push("/memberships")}
        />
      ) : !filtered.length ? (
        <EmptyState
          icon="search"
          title="No matches"
          message="Try a different session, speaker or event."
          actionLabel="Clear search"
          onAction={() => setQuery("")}
        />
      ) : (
        <Animated.View layout={LinearTransition} style={styles.stack}>
          {featured ? (
            <Animated.View entering={FadeInDown.springify()}>
              <Text style={styles.groupLabel}>Latest</Text>
              <FeaturedCard
                item={featured}
                onOpen={() => router.push(`/watch/${featured.id}`)}
              />
            </Animated.View>
          ) : null}

          {groups.map(([plan, items]) => (
            <View key={plan}>
              <Text style={styles.groupLabel}>
                {plan} · {items.length} {pluralize(items.length, "recording", "recordings")}
              </Text>
              <View style={styles.rows}>
                {items.map((item, idx) => (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(stagger(idx)).springify()}
                    layout={LinearTransition}
                  >
                    <WatchRow item={item} onOpen={() => router.push(`/watch/${item.id}`)} />
                  </Animated.View>
                ))}
              </View>
            </View>
          ))}
        </Animated.View>
      )}
    </Screen>
  );
}

function ScreenHeaderRow({ searching, onToggle }: { searching: boolean; onToggle: () => void }) {
  return (
    <ScreenTitle
      title="Watch"
      right={
        <IconButton
          icon={searching ? "x" : "search"}
          label={searching ? "Close search" : "Search recordings"}
          onPress={onToggle}
        />
      }
    />
  );
}

function FeaturedCard({ item, onOpen }: { item: WatchItem; onOpen: () => void }) {
  const premiere = item.kind === "simulive" && notYetPremiered(item.premiereAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={{ disabled: premiere }}
      disabled={premiere}
      onPress={onOpen}
      style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
    >
      <View style={styles.featuredPoster}>
        <EventCover uri={item.thumbnailUrl} name={item.name} height={196} radius={0} />
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0.6 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.playDisc}>
          <Icon
            name={premiere ? "clock" : "play"}
            size={24}
            color={colors.paperForeground}
            style={premiere ? undefined : styles.playGlyph}
          />
        </View>
        {premiere ? (
          <View style={styles.premiereChip}>
            <Text style={styles.premiereText}>Premieres {fmtDateTime(item.premiereAt)}</Text>
          </View>
        ) : item.duration ? (
          <View style={styles.durationChip}>
            <Text style={styles.durationText}>{item.duration}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.featuredBody}>
        <Text style={styles.featuredName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.featuredMeta} numberOfLines={1}>
          {[item.session, item.speaker, item.eventName].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

function WatchRow({ item, onOpen }: { item: WatchItem; onOpen: () => void }) {
  const premiere = item.kind === "simulive" && notYetPremiered(item.premiereAt);
  const access = accessLine(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={{ disabled: premiere }}
      disabled={premiere}
      onPress={onOpen}
      style={({ pressed }) => [styles.row, premiere && styles.rowDim, pressed && styles.pressed]}
    >
      <View style={styles.thumb}>
        <EventCover uri={item.thumbnailUrl} name={item.name} height={68} radius={0} />
        <View style={styles.thumbGlyph} pointerEvents="none">
          <Icon
            name={premiere ? "clock" : "circle-play"}
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </View>
        {item.duration && !premiere ? (
          <View style={styles.thumbDuration}>
            <Text style={styles.thumbDurationText}>{item.duration}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.rowStack}>
        <Text style={styles.rowName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[item.session, item.eventName].filter(Boolean).join(" · ")}
        </Text>
        <View style={styles.accessRow}>
          <Icon
            name="clock"
            size={12}
            color={access.leaving ? colors.warning : colors.textTertiary}
          />
          <Text style={[styles.accessText, access.leaving && styles.accessLeaving]} numberOfLines={1}>
            {premiere ? `Premieres ${fmtDateTime(item.premiereAt)}` : access.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  pressed: {
    opacity: 0.75,
  },
  search: {
    marginBottom: spacing.md,
  },
  groupLabel: {
    ...type.subhead,
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  featured: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
  featuredPoster: {
    justifyContent: "center",
    alignItems: "center",
  },
  playDisc: {
    position: "absolute",
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  playGlyph: {
    marginLeft: 3,
  },
  durationChip: {
    position: "absolute",
    right: spacing.sm + 2,
    bottom: spacing.sm + 2,
    borderRadius: radius.sm - 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  durationText: {
    ...type.micro,
    fontSize: 11,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  premiereChip: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: `${colors.warning}26`,
    borderWidth: 1,
    borderColor: `${colors.warning}4D`,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
  },
  premiereText: {
    ...type.micro,
    fontSize: 11,
    color: colors.warning,
  },
  featuredBody: {
    padding: 14,
    gap: 5,
  },
  featuredName: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  featuredMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  rows: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowDim: {
    opacity: 0.7,
  },
  thumb: {
    width: 120,
    height: 68,
    overflow: "hidden",
    borderRadius: radius.md - 2,
    backgroundColor: colors.surfaceActive,
  },
  thumbGlyph: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbDuration: {
    position: "absolute",
    right: 6,
    bottom: 6,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  thumbDurationText: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowName: {
    ...type.label,
    color: colors.foreground,
  },
  rowMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  accessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  accessText: {
    ...type.caption,
    fontSize: 11,
    flexShrink: 1,
    color: colors.textTertiary,
  },
  accessLeaving: {
    color: colors.warning,
  },
});
