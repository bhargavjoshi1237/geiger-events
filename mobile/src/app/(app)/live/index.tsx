import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition, useSharedValue } from "react-native-reanimated";

import { Countdown } from "@/components/Countdown";
import { RoundRail } from "@/components/RoundRail";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { usePoll } from "@/lib/use_poll";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { LiveRoom } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;
const POLL_MS = 30_000;

function isFuture(dateStr: string | null): boolean {
  return !!dateStr && new Date(dateStr).getTime() > Date.now();
}

export default function LiveScreen() {
  const router = useRouter();
  const { token } = useSession();
  const [rooms, setRooms] = useState<LiveRoom[] | null>(null);
  const scrollY = useSharedValue(0);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await api<{ rooms: LiveRoom[] }>("/api/portal/live", { token });
    setRooms(res.ok ? res.data.rooms : []);
  }, [token]);

  usePoll(load, POLL_MS, true);

  return (
    <Screen scroll onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader
        title="Live"
        subtitle="Rooms, webinars and breakouts happening now or coming up."
        scrollY={scrollY}
      />
      {rooms === null ? (
        <SkeletonList rows={3} />
      ) : rooms.length ? (
        <Animated.View layout={LinearTransition} style={styles.list}>
          {rooms.map((room, idx) => (
            <Animated.View
              key={room.id}
              entering={FadeInDown.delay(stagger(idx)).springify()}
              layout={LinearTransition}
            >
              <RoomCard room={room} onOpen={() => router.push(`/live/${room.id}`)} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : (
        <EmptyState
          icon="radio"
          title="No live sessions"
          message="Rooms you have access to will show up here when they open."
        />
      )}
    </Screen>
  );
}

function RoomCard({ room, onOpen }: { room: LiveRoom; onOpen: () => void }) {
  const startsFuture = isFuture(room.startsAt);

  return (
    <Card style={styles.roomCard}>
      <View style={styles.roomHead}>
        <Text style={styles.roomName} numberOfLines={1}>
          {room.name}
        </Text>
        <Pill
          label={room.openNow ? "Live now" : room.state}
          tone={room.openNow ? "success" : "neutral"}
        />
      </View>
      {room.eventName ? (
        <Text style={styles.roomEvent} numberOfLines={1}>
          {room.eventName}
        </Text>
      ) : null}

      {room.openNow ? (
        room.liveNow > 0 ? (
          <Text style={styles.watching}>{room.liveNow} watching</Text>
        ) : null
      ) : room.startsAt ? (
        startsFuture ? (
          <View style={styles.countdownWrap}>
            <Countdown dateStr={room.startsAt} />
          </View>
        ) : (
          <Text style={styles.roomTime}>{fmtDateTime(room.startsAt)}</Text>
        )
      ) : null}

      {room.openNow ? (
        <View style={styles.roomAction}>
          {room.watchUrl ? (
            <Button title="Watch" icon="play" onPress={onOpen} fullWidth />
          ) : room.joinUrl ? (
            <Button
              title="Join"
              icon="video"
              onPress={() => void WebBrowser.openBrowserAsync(room.joinUrl)}
              fullWidth
            />
          ) : (
            <Button title="Opens soon" disabled fullWidth />
          )}
        </View>
      ) : null}

      {room.parentSessionId ? <RoundRail parentSessionId={room.parentSessionId} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  roomCard: {
    gap: spacing.sm,
  },
  roomHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  roomName: {
    flex: 1,
    ...type.label,
    fontWeight: "600",
    color: colors.foreground,
  },
  roomEvent: {
    ...type.caption,
    color: colors.textSecondary,
  },
  watching: {
    ...type.caption,
    color: colors.textTertiary,
  },
  countdownWrap: {
    marginTop: spacing.xs,
  },
  roomTime: {
    ...type.caption,
    color: colors.textTertiary,
  },
  roomAction: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    overflow: "hidden",
  },
});
