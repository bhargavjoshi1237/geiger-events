import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { colors, radius, spacing, type } from "@/theme/tokens";

type Props = { value: string[]; onChange: (next: string[]) => void; placeholder?: string };

// A list of short strings (poll options, survey questions): remove any, add at the end.
export function ListEditor({ value, onChange, placeholder }: Props) {
  const [adding, setAdding] = useState("");

  const add = () => {
    const item = adding.trim();
    if (!item) return;
    onChange([...value, item]);
    setAdding("");
  };

  return (
    <View style={styles.stack}>
      {value.length ? (
        <View style={styles.group}>
          {value.map((item, i) => (
            <View key={`${i}-${item}`} style={[styles.row, i < value.length - 1 && styles.divided]}>
              <Text style={styles.item}>{item}</Text>
              <IconButton
                icon="x"
                label={`Remove ${item}`}
                variant="plain"
                size={32}
                iconSize={16}
                onPress={() => onChange(value.filter((_, j) => j !== i))}
              />
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.addRow}>
        <View style={styles.addInput}>
          <Input value={adding} onChangeText={setAdding} placeholder={placeholder ?? "Add an item…"} onSubmitEditing={add} returnKeyType="done" />
        </View>
        <IconButton icon="plus" label="Add item" variant="solid" onPress={add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  item: {
    ...type.body,
    flex: 1,
    color: colors.foreground,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  addInput: {
    flex: 1,
  },
});
