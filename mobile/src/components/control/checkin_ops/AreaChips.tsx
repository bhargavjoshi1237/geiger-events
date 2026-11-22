import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { NamedArea } from "@/types/control_checkin_ops";

type Props = { options: NamedArea[]; selected: string[]; onChange: (next: string[]) => void; empty: string };

// Several gates or zones at once; none picked means the role works everywhere.
export function AreaChips({ options, selected, onChange, empty }: Props) {
  if (!options.length) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <Pressable
            key={o.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.name}
            hitSlop={6}
            onPress={() => {
              selectionFeedback();
              onChange(on ? selected.filter((id) => id !== o.id) : [...selected, o.id]);
            }}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
          >
            {on ? <Icon name="check" size={13} color={colors.foreground} /> : null}
            <Text style={[styles.label, on && styles.labelOn]}>{o.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipOn: {
    borderColor: colors.foreground,
    backgroundColor: colors.surfaceStrong,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...type.captionStrong,
    fontSize: 13,
    color: colors.textSecondary,
  },
  labelOn: {
    color: colors.foreground,
  },
  empty: {
    ...type.caption,
    color: colors.textTertiary,
  },
});
