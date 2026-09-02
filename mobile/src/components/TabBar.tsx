import { BlurView } from "expo-blur";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Icon, type IconName } from "@/components/ui/icons";
import { PulseDot } from "@/components/ui/PulseDot";
import { selectionFeedback } from "@/lib/haptics";
import { usePortalData } from "@/state/data";
import { colors, fonts, spacing, spring, type } from "@/theme/tokens";

export const TAB_BAR_HEIGHT = 62;

const TAB_ORDER = ["home", "tickets", "live", "inbox", "more"] as const;

const TAB_META: Record<
  string,
  { label: string; icon: IconName }
> = {
  home: { label: "Home", icon: "house" },
  tickets: { label: "Tickets", icon: "credit-card" },
  live: { label: "Live", icon: "radio" },
  inbox: { label: "Inbox", icon: "inbox" },
  more: { label: "More", icon: "menu" },
};

// Routes with no _layout in their folder register under their file path
// ("home/index", "tickets/[id]"), so match on the first segment, not the whole name.
const tabOf = (routeName: string) => routeName.split("/")[0];

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { counts } = usePortalData();

  type TabEntry = { tab: (typeof TAB_ORDER)[number]; route: (typeof state.routes)[number] };
  const visible = TAB_ORDER.map((tab) => {
    const route =
      state.routes.find((r) => r.name === `${tab}/index`) ||
      state.routes.find((r) => r.name === tab);
    return route ? { tab, route } : null;
  }).filter((entry): entry is TabEntry => Boolean(entry));
  const activeTab = tabOf(state.routes[state.index]?.name || "");

  const onTabPress = (name: string) => {
    selectionFeedback();
    navigation.navigate(name);
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
      <View style={styles.scrim} />
      <View style={styles.row}>
        {visible.map(({ tab, route }) => {
          const meta = TAB_META[tab];
          return (
            <TabButton
              key={route.key}
              label={meta.label}
              icon={meta.icon}
              focused={tab === activeTab}
              badge={tab === "inbox" ? counts.inbox || 0 : 0}
              live={tab === "live" && Boolean(counts.liveNow)}
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
  icon: IconName;
  focused: boolean;
  badge: number;
  live: boolean;
  onPress: () => void;
};

function TabButton({ label, icon, focused, badge, live, onPress }: TabButtonProps) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(focused ? 1.1 : 1, spring);
  }, [focused, scale]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tint = focused ? colors.primary : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge > 0 ? `${label}, ${badge} unread` : label}
      onPress={onPress}
      style={styles.tab}
      hitSlop={4}
    >
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <Icon name={icon} size={22} color={tint} />
        {live ? <PulseDot size={7} style={styles.liveDot} /> : null}
        {badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        ) : null}
      </Animated.View>
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceHover,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.glassScrim,
  },
  row: {
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  liveDot: {
    position: "absolute",
    top: -1,
    right: -3,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -9,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 13,
    color: colors.primaryForeground,
    fontVariant: ["tabular-nums"],
  },
  label: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 12,
  },
});
