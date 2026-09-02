import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { Icon } from "@/components/ui/icons";
import { Perforation } from "@/components/ui/Perforation";
import { Pill } from "@/components/ui/Pill";
import { tapFeedback } from "@/lib/haptics";
import type { Tone } from "@/lib/status";
import { colors, radius, spacing, spring, type } from "@/theme/tokens";

type TicketPassCardProps = {
  image?: string | null;
  name: string;
  ticketLine: string;
  venue?: string;
  status?: { label: string; tone: Tone } | null;
  timing: string;
  price: string;
  muted?: boolean;
  onPress: () => void;
  onShowPass?: () => void;
};

// The stacked pass in the Tickets wallet: detail block, tear line, then the stub row.
export function TicketPassCard({
  image,
  name,
  ticketLine,
  venue,
  status,
  timing,
  price,
  muted = false,
  onPress,
  onShowPass,
}: TicketPassCardProps) {
  const scaleRef = useSharedValue(1);
  const pressIn = () => {
    scaleRef.value = withSpring(0.985, spring);
  };
  const pressOut = () => {
    scaleRef.value = withSpring(1, spring);
  };
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleRef.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${timing}`}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
    >
      <Animated.View style={[styles.card, muted && styles.cardMuted, animStyle]}>
        <View style={styles.head}>
          <View style={styles.cover}>
            {image ? (
              <Image
                source={{ uri: image }}
                contentFit="cover"
                transition={200}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Text style={styles.coverInitial}>{(name || "E").slice(0, 1).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.headStack}>
            <Text style={styles.name} numberOfLines={2}>
              {name || "Untitled event"}
            </Text>
            <Text style={styles.ticketLine} numberOfLines={1}>
              {ticketLine}
            </Text>
            {status ? (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: TONE_COLORS[status.tone] }]} />
                <Text style={[styles.statusText, { color: TONE_COLORS[status.tone] }]} numberOfLines={1}>
                  {status.label}
                </Text>
              </View>
            ) : venue ? (
              <Text style={styles.venue} numberOfLines={1}>
                {venue}
              </Text>
            ) : null}
          </View>
        </View>

        <Perforation notchColor={colors.background} />

        <View style={styles.stub}>
          <Pill label={timing} tone={muted ? "neutral" : "success"} dot={false} />
          <Text style={styles.price}>{price}</Text>
          {onShowPass ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Show pass for ${name}`}
              hitSlop={6}
              onPress={() => {
                tapFeedback();
                onShowPass();
              }}
              style={({ pressed }) => [
                styles.passBtn,
                muted && styles.passBtnMuted,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name="maximize"
                size={15}
                color={muted ? colors.foreground : colors.primaryForeground}
              />
              <Text style={[styles.passBtnText, muted && styles.passBtnTextMuted]}>Pass</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const TONE_COLORS: Record<Tone, string> = {
  success: colors.success,
  danger: colors.danger,
  info: colors.info,
  warning: colors.warning,
  neutral: colors.mutedForeground,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl - 2,
    overflow: "hidden",
  },
  cardMuted: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.surfaceHover,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: spacing.lg,
  },
  cover: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceActive,
  },
  coverInitial: {
    ...type.title,
    fontSize: 18,
    color: colors.mutedForeground,
  },
  headStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    ...type.bodyStrong,
    fontSize: 16,
    lineHeight: 20,
    color: colors.foreground,
  },
  ticketLine: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  venue: {
    ...type.caption,
    color: colors.textTertiary,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...type.captionStrong,
    flexShrink: 1,
  },
  stub: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  price: {
    ...type.label,
    color: colors.mutedForeground,
    fontVariant: ["tabular-nums"],
  },
  passBtn: {
    height: 38,
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: radius.md - 2,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
  },
  passBtnMuted: {
    backgroundColor: colors.surfaceActive,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  passBtnText: {
    ...type.labelStrong,
    fontSize: 13,
    color: colors.primaryForeground,
  },
  passBtnTextMuted: {
    color: colors.foreground,
  },
});
