import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { Pill } from "@/components/ui/Pill";
import { tapFeedback } from "@/lib/haptics";
import type { Tone } from "@/lib/status";
import { colors, radius, spacing, spring, type } from "@/theme/tokens";

type MetaItem = {
  label: string;
  muted?: boolean;
  pill?: { label: string; tone: Tone };
};

type TicketStubProps = {
  image?: string | null;
  icon?: React.ComponentProps<typeof Feather>["name"];
  name: string;
  description?: string;
  meta?: MetaItem[];
  stubValue: string;
  stubLabel?: string;
  onPress?: () => void;
};

export function TicketStub({
  image,
  icon = "credit-card",
  name,
  description,
  meta = [],
  stubValue,
  stubLabel = "price",
  onPress,
}: TicketStubProps) {
  const scaleRef = useSharedValue(1);
  const pressIn = () => {
    scaleRef.value = withSpring(0.985, spring);
  };
  const pressOut = () => {
    scaleRef.value = withSpring(1, spring);
  };
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleRef.value }],
  }));

  const card = (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.chip}>
            {image ? (
              <Image source={{ uri: image }} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} />
            ) : (
              <Feather name={icon} size={18} color={colors.textTertiary} />
            )}
          </View>
          <View style={styles.stack}>
            <Text style={styles.name} numberOfLines={1}>
              {name || "Untitled"}
            </Text>
            {description ? (
              <Text style={styles.description} numberOfLines={1}>
                {description}
              </Text>
            ) : null}
          </View>
        </View>
        {meta.length ? (
          <View style={styles.metaRow}>
            {meta.map((item, idx) => (
              <React.Fragment key={`${item.label}-${idx}`}>
                {idx > 0 ? <Text style={styles.metaSep}>·</Text> : null}
                {item.pill ? (
                  <Pill label={item.pill.label} tone={item.pill.tone} />
                ) : (
                  <Text style={[styles.meta, item.muted && styles.metaMuted]}>{item.label}</Text>
                )}
              </React.Fragment>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.perforation}>
        <View style={styles.dashColumn}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={[styles.notch, styles.notchTop]} />
        <View style={[styles.notch, styles.notchBottom]} />
      </View>

      <View style={styles.stub}>
        <Text style={styles.stubValue} numberOfLines={1}>
          {stubValue}
        </Text>
        <Text style={styles.stubLabel}>{stubLabel}</Text>
      </View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => {
          tapFeedback();
          onPress();
        }}
      >
        {card}
      </Pressable>
    );
  }
  return card;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
    padding: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  chip: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...type.body,
    fontWeight: "600",
    color: colors.foreground,
  },
  description: {
    ...type.caption,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: spacing.sm,
    rowGap: 2,
  },
  metaSep: {
    ...type.caption,
    color: colors.textTertiary,
    fontSize: 14,
    lineHeight: 15,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  metaMuted: {
    color: colors.textTertiary,
  },
  perforation: {
    width: 1,
    alignSelf: "stretch",
    position: "relative",
  },
  dashColumn: {
    flex: 1,
    justifyContent: "space-around",
    alignItems: "center",
  },
  dash: {
    width: 1,
    height: 3,
    borderRadius: 0.5,
    backgroundColor: colors.border,
  },
  notch: {
    position: "absolute",
    left: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  notchTop: {
    top: -6,
  },
  notchBottom: {
    bottom: -6,
  },
  stub: {
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  stubValue: {
    ...type.title,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  stubLabel: {
    ...type.caption,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: colors.textTertiary,
  },
});
