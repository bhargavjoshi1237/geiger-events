import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ListGroup } from "@/components/ui/ListGroup";
import { Segmented } from "@/components/ui/Segmented";
import { selectionFeedback } from "@/lib/haptics";
import type { Tone } from "@/lib/status";
import { colors, radius, spacing, type } from "@/theme/tokens";

export type Choice = { value: string; label: string; tone?: Tone };

type Props = {
  options: Choice[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  // "chips" forces wrapping chips (statuses); "auto" picks by option count and label length.
  layout?: "auto" | "chips";
};

const TINT: Record<Tone, string> = {
  success: colors.success,
  danger: colors.danger,
  info: colors.info,
  warning: colors.warning,
  neutral: colors.mutedForeground,
};

// One-of-many: a segmented track for a few short options, wrapping chips for more, a radio list when labels are sentences.
export function ChoicePicker({ options, value, onChange, label, layout = "auto" }: Props) {
  if (!options.length) return <Text style={styles.empty}>No options to choose from yet.</Text>;

  const longest = options.reduce((n, o) => Math.max(n, o.label.length), 0);
  const mode = layout === "chips" ? "chips" : longest > 26 ? "radio" : options.length <= 3 && longest <= 14 ? "segmented" : "chips";
  const pick = (next: string) => {
    selectionFeedback();
    if (next !== value) onChange(next);
  };

  if (mode === "segmented") {
    // The track shares the panel's fill, so a hairline frame keeps its edge.
    return (
      <View style={styles.segmentFrame}>
        <Segmented options={options} value={value} onChange={onChange} />
      </View>
    );
  }

  if (mode === "radio") {
    return (
      <ListGroup>
        <View accessibilityRole="radiogroup" accessibilityLabel={label}>
          {options.map((o, i) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={o.label}
                onPress={() => pick(o.value)}
                style={({ pressed }) => [styles.radioRow, i < options.length - 1 && styles.divided, pressed && styles.pressed]}
              >
                <View style={[styles.radio, active && styles.radioOn]}>{active ? <View style={styles.radioDot} /> : null}</View>
                <Text style={[styles.radioLabel, active && styles.radioLabelOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ListGroup>
    );
  }

  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const active = o.value === value;
        const tint = o.tone && o.tone !== "neutral" ? TINT[o.tone] : null;
        const activeStyle = tint ? { backgroundColor: `${tint}1F`, borderColor: `${tint}66` } : styles.chipOn;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.label}
            hitSlop={5}
            onPress={() => pick(o.value)}
            style={({ pressed }) => [styles.chip, active && activeStyle, pressed && styles.pressed]}
          >
            {o.tone ? <View style={[styles.dot, { backgroundColor: TINT[o.tone] }]} /> : null}
            <Text style={[styles.chipLabel, active && (tint ? { color: tint } : styles.chipLabelOn)]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    ...type.caption,
    color: colors.textTertiary,
  },
  segmentFrame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 1,
    overflow: "hidden",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    height: 34,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 14,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipLabel: {
    ...type.captionStrong,
    flexShrink: 1,
    color: colors.mutedForeground,
  },
  chipLabelOn: {
    color: colors.primaryForeground,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.md,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 10,
  },
  radioOn: {
    borderColor: colors.foreground,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.foreground,
  },
  radioLabel: {
    ...type.label,
    flex: 1,
    color: colors.mutedForeground,
  },
  radioLabelOn: {
    color: colors.foreground,
  },
});
