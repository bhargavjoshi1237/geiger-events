import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { VideoPlayer } from "@/components/VideoPlayer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDate } from "@/lib/format";
import { usePortalData } from "@/state/data";
import { colors, spacing, type } from "@/theme/tokens";
import type { WatchItem } from "@/types/portal";

export default function WatchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { watch, loading } = usePortalData();

  if (loading.watch) {
    return (
      <Screen scroll>
        <ScreenHeader title="Watch" />
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const item = watch?.find((w) => w.id === id);
  if (!item) {
    return (
      <Screen scroll>
        <ScreenHeader title="Watch" />
        <EmptyState
          icon="circle-play"
          title="Recording not found"
          message="This recording isn't on your account anymore."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title={item.name}
        subtitle={[item.session, item.eventName].filter(Boolean).join(" · ")}
      />
      <PlayerView item={item} />
    </Screen>
  );
}

function PlayerView({ item }: { item: WatchItem }) {
  return (
    <>
      <View style={styles.playerSlot}>
        <VideoPlayer
          url={item.videoUrl}
          heartbeatId={item.id}
          thumbnailUrl={item.thumbnailUrl}
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
        <Icon name="circle-check" size={14} color={colors.textSecondary} />
        <Text style={styles.accessText}>Included with {item.planName}</Text>
      </View>
      {item.expiresAt ? (
        <Text style={styles.until}>Available until {fmtDate(item.expiresAt)}</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  playerSlot: {
    marginBottom: spacing.lg,
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
