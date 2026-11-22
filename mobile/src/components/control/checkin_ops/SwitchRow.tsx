import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { type IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Switch } from "@/components/ui/Switch";
import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  title: string;
  detail?: string;
  icon?: IconName;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  divider?: boolean;
};

// One permission inside a ListGroup: what it allows and its switch; the glyph dims to an outline while it's off.
export function SwitchRow({ title, detail, icon, value, onValueChange, disabled = false, divider = true }: Props) {
  return (
    <View style={[styles.row, divider && styles.divided]}>
      {icon ? <IconTile icon={icon} size={36} tone={value ? "neutral" : "outline"} /> : null}
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} label={title} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  detail: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
