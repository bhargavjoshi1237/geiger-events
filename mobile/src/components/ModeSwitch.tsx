import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";

export type ModeOption = {
  icon: IconName;
  title: string;
  detail: string;
  // The mode you're in has no onPress; the other one switches (or signs in) when tapped.
  onPress?: () => void;
};

type Props = { attendee: ModeOption; control: ModeOption; active: "attendee" | "control" };

// The two halves of the app side by side, so switching reads as a choice rather than a buried link.
export function ModeSwitch({ attendee, control, active }: Props) {
  return (
    <View style={styles.row}>
      <ModeTile option={attendee} active={active === "attendee"} />
      <ModeTile option={control} active={active === "control"} />
    </View>
  );
}

function ModeTile({ option, active }: { option: ModeOption; active: boolean }) {
  const content = (
    <>
      <View style={styles.top}>
        <View style={[styles.glyph, active && styles.glyphActive]}>
          <Icon name={option.icon} size={18} color={active ? colors.primaryForeground : colors.mutedForeground} />
        </View>
        {active ? (
          <View style={styles.current}>
            <Icon name="check" size={12} color={colors.success} />
            <Text style={styles.currentText}>In use</Text>
          </View>
        ) : (
          <Icon name="arrow-left-right" size={15} color={colors.textTertiary} />
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {option.title}
        </Text>
        <Text style={styles.detail} numberOfLines={2}>
          {option.detail}
        </Text>
      </View>
    </>
  );

  if (active || !option.onPress) {
    return (
      <View style={[styles.tile, active && styles.tileActive]} accessible accessibilityLabel={`${option.title}, ${active ? "in use" : option.detail}`}>
        {content}
      </View>
    );
  }
  const onPress = option.onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${option.title}. ${option.detail}`}
      onPress={() => {
        selectionFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm + 2,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 128,
    justifyContent: "space-between",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md + 2,
  },
  tileActive: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
  },
  pressed: {
    opacity: 0.7,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  glyph: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceActive,
  },
  glyphActive: {
    backgroundColor: colors.primary,
  },
  current: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  currentText: {
    ...type.micro,
    color: colors.success,
  },
  text: {
    gap: 3,
  },
  title: {
    ...type.labelStrong,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  detail: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
