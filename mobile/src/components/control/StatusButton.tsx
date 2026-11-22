import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { tapFeedback } from "@/lib/haptics";
import type { Tone } from "@/lib/status";
import { colors, radius, spacing, type } from "@/theme/tokens";

const TINT: Record<Tone, string> = {
  success: colors.success,
  danger: colors.danger,
  info: colors.info,
  warning: colors.warning,
  neutral: colors.mutedForeground,
};

type Props = {
  label: string;
  tone: Tone;
  // Without onPress it reads as a plain status capsule (the role can't change it).
  onPress?: () => void;
  accessibilityLabel?: string;
};

// A status capsule that opens a picker: tinted dot, label and an up-down chevron.
export function StatusButton({ label, tone, onPress, accessibilityLabel }: Props) {
  const tint = TINT[tone];
  const body = (
    <>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
      {onPress ? <Icon name="chevrons-up-down" size={13} color={tint} /> : null}
    </>
  );
  const frame = [styles.capsule, { borderColor: `${tint}4D`, backgroundColor: `${tint}14` }];
  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Status: ${label}. Change`}
      hitSlop={8}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [frame, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md - 2,
  },
  pressed: {
    opacity: 0.7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  label: {
    ...type.captionStrong,
  },
});
