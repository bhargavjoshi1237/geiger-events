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
  const [, setTick] = useState(0);

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
