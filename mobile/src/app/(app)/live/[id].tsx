import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { RoomRounds } from "@/components/RoomRounds";
import { ScreenHeader } from "@/components/ScreenHeader";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PulseDot } from "@/components/ui/PulseDot";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { usePoll } from "@/lib/use_poll";
import { useLivePlayer } from "@/state/live_player";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { LiveRoom } from "@/types/portal";

const POLL_MS = 30_000;

export default function LiveRoomScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const { dock, clear } = useLivePlayer();
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await api<{ room: LiveRoom }>(`/api/portal/live/${id}`, { token });
    if (res.ok) setRoom(res.data.room);
    setLoaded(true);
  }, [id, token]);

  usePoll(load, POLL_MS, true);

  const watchable = Boolean(room?.watchUrl);
  useEffect(() => {
    if (!room || !watchable) return;
    dock({ id: room.id, name: room.name, eventName: room.eventName });
  }, [room, watchable, dock]);

  if (!loaded) {
    return (
      <Screen scroll>
        <ScreenHeader title="Live" />
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (!room) {
    return (
      <Screen scroll>
        <ScreenHeader title="Live" />
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
    <Screen scroll>
      <ScreenHeader
        title={room.name}
        subtitle={[room.eventName, room.planName].filter(Boolean).join(" · ")}
        onBack={() => {
          clear();
          router.back();
        }}
        right={
          room.openNow ? (
            <View style={styles.liveChip}>
              <PulseDot size={6} />
              <Text style={styles.liveChipText}>
                LIVE{room.liveNow > 0 ? ` · ${room.liveNow}` : ""}
              </Text>
            </View>
          ) : null
        }
      />

      {watchable ? (
        <RoomPlayer room={room} />
      ) : (
        <View style={styles.offAir}>
          <Text style={styles.offAirTitle}>
            {room.openNow ? "This room runs outside the app" : "Not open yet"}
          </Text>
          <Text style={styles.offAirBody}>
            {room.openNow
              ? "Join in the browser — your seat is held."
              : room.startsAt
                ? `Opens ${fmtDateTime(room.startsAt)}.`
                : "The organiser hasn't opened this room yet."}
          </Text>
          {room.openNow && room.joinUrl ? (
            <Button
              title="Join in browser"
              icon="external-link"
              onPress={() => void WebBrowser.openBrowserAsync(room.joinUrl)}
              fullWidth
            />
          ) : null}
        </View>
      )}

      <View style={styles.body}>
        <RoomRounds parentSessionId={room.parentSessionId || null} liveNow={room.liveNow} />
        {room.description ? <Text style={styles.description}>{room.description}</Text> : null}
      </View>
    </Screen>
  );
}

function RoomPlayer({ room }: { room: LiveRoom }) {
  return <VideoPlayer url={room.watchUrl} heartbeatId={room.id} />;
}

const styles = StyleSheet.create({
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.sm - 2,
    backgroundColor: colors.scrim,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm + 1,
  },
  liveChipText: {
    ...type.kicker,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.primary,
  },
  offAir: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg + 2,
  },
  offAirTitle: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  offAirBody: {
    ...type.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  body: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  description: {
    ...type.body,
    color: colors.mutedForeground,
  },
});
