import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Switch } from "@/components/ui/Switch";
import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
};

// An on/off setting as a row: what it does on the left, the switch on the right.
export function ToggleRow({ label, hint, value, onValueChange, disabled = false }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} label={label} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  label: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  hint: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
