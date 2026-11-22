import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";

export type PickerOption = { value: string; label: string; detail?: string };

type Props = {
  visible: boolean;
  title: string;
  options: PickerOption[];
  value: string;
  onPick: (value: string) => void;
  onClose: () => void;
  emptyText?: string;
};

// Choose one item, event or plan from a searchable list; picking closes the sheet.
export function PickerSheet({ visible, title, options, value, onPick, onClose, emptyText = "Nothing to choose yet." }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => `${o.label} ${o.detail ?? ""}`.toLowerCase().includes(q)) : options;

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        {options.length > 6 ? <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search…" autoCapitalize="none" /> : null}
        {!shown.length ? (
          <Text style={styles.empty}>{options.length ? "Nothing matches." : emptyText}</Text>
        ) : (
          <ScrollView style={styles.group} keyboardShouldPersistTaps="handled">
            {shown.map((o, i) => (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: o.value === value }}
                accessibilityLabel={o.detail ? `${o.label}, ${o.detail}` : o.label}
                onPress={() => {
                  selectionFeedback();
                  onPick(o.value);
                  setQuery("");
                  onClose();
                }}
                style={({ pressed }) => [styles.row, i < shown.length - 1 && styles.divided, pressed && styles.pressed]}
              >
                <View style={styles.text}>
                  <Text style={styles.label} numberOfLines={1}>
                    {o.label}
                  </Text>
                  {o.detail ? (
                    <Text style={styles.detail} numberOfLines={1}>
                      {o.detail}
                    </Text>
                  ) : null}
                </View>
                {o.value === value ? <Icon name="check" size={18} color={colors.foreground} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    maxHeight: 380,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 13,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...type.body,
    color: colors.foreground,
  },
  detail: {
    ...type.caption,
    color: colors.textSecondary,
  },
  empty: {
    ...type.body,
    color: colors.textSecondary,
  },
});
