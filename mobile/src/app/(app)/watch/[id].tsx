import { Feather } from "@expo/vector-icons";
import { useEvent } from "expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDate } from "@/lib/format";
import { useHeartbeat } from "@/lib/use_heartbeat";
import { useAppFocused } from "@/lib/use_poll";
import { usePortalData } from "@/state/data";
import { colors, spacing, type } from "@/theme/tokens";
import type { WatchItem } from "@/types/portal";

export default function WatchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { watch, loading, refreshing, refreshAll } = usePortalData();
  const scrollY = useSharedValue(0);

  // A deep link can land here before the library has loaded.
  if (loading.watch) {
    return (
      <Screen scroll onScroll={(y) => (scrollY.value = y)}>
        <ScreenHeader title="Watch" scrollY={scrollY} />
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const item = watch?.find((w) => w.id === id);
  if (!item) {
    return (
      <Screen scroll onScroll={(y) => (scrollY.value = y)}>
        <ScreenHeader title="Watch" scrollY={scrollY} />
        <EmptyState
          icon="play-circle"
          title="Recording not found"
          message="This recording isn't on your account anymore."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll} onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader title={item.name} scrollY={scrollY} />
      <PlayerView item={item} />
    </Screen>
  );
}

// Mounted only once the item exists so the player gets a real source.
function PlayerView({ item }: { item: WatchItem }) {
  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop = false;
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const focused = useAppFocused();
  useHeartbeat(item.id, isPlaying && focused);

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <>
      <View style={styles.playerFrame}>
        <VideoView
          player={player}
          allowsPictureInPicture
          nativeControls
          style={styles.video}
        />
      </View>

      <Text style={styles.meta}>
        {[item.session, item.speaker ? `with ${item.speaker}` : null, item.eventName]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      {item.tags.length ? (
        <View style={styles.tags}>
          {item.tags.map((t) => (
            <Pill key={t} label={t} tone="neutral" />
          ))}
        </View>
      ) : null}
      <View style={styles.access}>
        <Feather name="check-circle" size={14} color={colors.textSecondary} />
        <Text style={styles.accessText}>Included with {item.planName}</Text>
      </View>
      {item.expiresAt ? (
        <Text style={styles.until}>Available until {fmtDate(item.expiresAt)}</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  playerFrame: {
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.lg,
  },
  video: {
    aspectRatio: 16 / 9,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  description: {
    ...type.body,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  access: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  accessText: {
    ...type.caption,
    color: colors.textSecondary,
  },
  until: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
});
