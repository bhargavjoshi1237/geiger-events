import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Sheet } from "@/components/ui/Sheet";
import { selectionFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";

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
          <ListGroup>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {shown.map((o, i) => {
                const current = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: current }}
                    accessibilityLabel={o.detail ? `${o.label}, ${o.detail}` : o.label}
                    onPress={() => {
                      selectionFeedback();
                      onPick(o.value);
                      setQuery("");
                      onClose();
                    }}
                    style={({ pressed }) => [styles.row, i < shown.length - 1 && styles.divided, pressed && styles.pressed]}
                  >
                    <Text style={[styles.label, current && styles.labelOn]} numberOfLines={1}>
                      {o.label}
                    </Text>
                    {o.detail ? (
                      <Text style={styles.detail} numberOfLines={1}>
                        {o.detail}
                      </Text>
                    ) : null}
                    {current ? <Icon name="check" size={18} color={colors.foreground} /> : <View style={styles.checkSpace} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </ListGroup>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
  },
  list: {
    maxHeight: 380,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: 12,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    ...type.body,
    flex: 1,
    color: colors.foreground,
  },
  labelOn: {
    ...type.bodyStrong,
  },
  detail: {
    ...type.monoSmall,
    fontSize: 11,
    flexShrink: 0,
    maxWidth: "40%",
    color: colors.textSecondary,
  },
  checkSpace: {
    width: 18,
  },
  empty: {
    ...type.body,
    color: colors.textSecondary,
  },
});
