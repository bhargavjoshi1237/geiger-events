import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { selectionFeedback } from "@/lib/haptics";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, spring, type } from "@/theme/tokens";

export const TAB_BAR_HEIGHT = 60;

const TAB_META: Record<
  string,
  { label: string; icon: React.ComponentProps<typeof Feather>["name"] }
> = {
  home: { label: "Home", icon: "home" },
  tickets: { label: "Tickets", icon: "credit-card" },
  watch: { label: "Watch", icon: "play-circle" },
  community: { label: "Community", icon: "message-circle" },
  more: { label: "More", icon: "grid" },
};

// The badge-dot tabs, keyed by route name.
const BADGE_ROUTES: Record<string, (counts: ReturnType<typeof usePortalData>["counts"]) => number> = {
  community: (c) => c.messages || 0,
  more: (c) => c.notifications || 0,
};

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { counts } = usePortalData();
  const reduced = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const progress = useSharedValue(0);

  const visible = state.routes.filter((r) => TAB_META[r.name]);
  const activeName = state.routes[state.index]?.name;
  const focusedIndex = visible.findIndex((r) => r.name === activeName);
  const segmentWidth = visible.length ? barWidth / visible.length : 0;

  useEffect(() => {
    if (segmentWidth <= 0 || focusedIndex < 0) return;
    const to = focusedIndex * segmentWidth;
    if (reduced) progress.value = to;
    else progress.value = withSpring(to, spring);
  }, [focusedIndex, segmentWidth, reduced, progress]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: Math.max(0, segmentWidth - spacing.md),
    transform: [{ translateX: progress.value }],
    opacity: focusedIndex >= 0 ? 1 : 0,
  }));

  const onTabPress = (name: string) => {
    selectionFeedback();
    navigation.navigate(name);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
    >
      <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
        <View style={styles.sheen} />
        <Animated.View style={[styles.indicator, indicatorStyle]} />
        {visible.map((route) => {
          const meta = TAB_META[route.name];
          const focused = route.name === activeName;
          const badge = BADGE_ROUTES[route.name]?.(counts) || 0;
          return (
            <TabButton
              key={route.key}
              label={meta.label}
              icon={meta.icon}
              focused={focused}
              badge={badge}
              onPress={() => onTabPress(route.name)}
            />
          );
        })}
      </View>
    </View>
  );
}

type TabButtonProps = {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  focused: boolean;
  badge: number;
  onPress: () => void;
};

function TabButton({ label, icon, focused, badge, onPress }: TabButtonProps) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(focused ? 1.12 : 1, spring);
  }, [focused, scale]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tint = focused ? colors.foreground : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tab}
      hitSlop={4}
    >
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <Feather name={icon} size={22} color={tint} />
        {badge > 0 ? <View style={styles.badge} /> : null}
      </Animated.View>
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.chipScrim,
  },
  indicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: spacing.md / 2,
    backgroundColor: colors.surfaceActive,
    borderRadius: radius.lg,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surfaceStrong,
  },
  label: {
    ...type.caption,
  },
});
