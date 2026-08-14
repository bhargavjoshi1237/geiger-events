import { useEvent } from "expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { RoundRail } from "@/components/RoundRail";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { useHeartbeat } from "@/lib/use_heartbeat";
import { useAppFocused, usePoll } from "@/lib/use_poll";
import { useSession } from "@/state/session";
import { colors, spacing, type } from "@/theme/tokens";
import type { LiveRoom } from "@/types/portal";

const POLL_MS = 30_000;

export default function LiveRoomScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollY = useSharedValue(0);

  // Refetch on mount so a deep link resolves, then poll to keep the count fresh.
  const load = useCallback(async () => {
    if (!token) return;
    const res = await api<{ room: LiveRoom }>(`/api/portal/live/${id}`, { token });
    if (res.ok) setRoom(res.data.room);
    setLoaded(true);
  }, [id, token]);

  usePoll(load, POLL_MS, true);

  if (!loaded) {
    return (
      <Screen scroll onScroll={(y) => (scrollY.value = y)}>
        <ScreenHeader title="Live" scrollY={scrollY} />
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (!room) {
    return (
      <Screen scroll onScroll={(y) => (scrollY.value = y)}>
        <ScreenHeader title="Live" scrollY={scrollY} />
        <EmptyState
          icon="radio"
          title="Room not found"
          message="This room isn't available anymore."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader title={room.name} subtitle={room.eventName} scrollY={scrollY} />
      <RoomPlayer room={room} />
      {room.liveNow > 0 ? (
        <Text style={styles.watching}>{room.liveNow} watching</Text>
      ) : null}
      {room.description ? <Text style={styles.description}>{room.description}</Text> : null}
      {room.parentSessionId ? <RoundRail parentSessionId={room.parentSessionId} /> : null}
    </Screen>
  );
}

function RoomPlayer({ room }: { room: LiveRoom }) {
  const player = useVideoPlayer(room.watchUrl, (p) => {
    p.loop = false;
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const focused = useAppFocused();
  useHeartbeat(room.id, isPlaying && focused);

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <View style={styles.playerFrame}>
      <VideoView
        player={player}
        allowsPictureInPicture
        nativeControls
        style={styles.video}
      />
    </View>
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
  watching: {
    ...type.caption,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  description: {
    ...type.body,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
});
