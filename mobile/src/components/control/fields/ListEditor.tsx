import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { colors, spacing, type } from "@/theme/tokens";

type Props = { value: string[]; onChange: (next: string[]) => void; placeholder?: string };

// A list of short strings (poll options, survey questions, tags): numbered rows to remove from, an input to add at the end.
export function ListEditor({ value, onChange, placeholder }: Props) {
  const [adding, setAdding] = useState("");
  const ready = adding.trim().length > 0;

  const add = () => {
    const item = adding.trim();
    if (!item) return;
    onChange([...value, item]);
    setAdding("");
  };

  return (
    <View style={styles.stack}>
      {value.length ? (
        <ListGroup>
          {value.map((item, i) => (
            <View key={`${i}-${item}`} style={[styles.row, i < value.length - 1 && styles.divided]}>
              <Text style={styles.index}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={styles.item}>{item}</Text>
              <IconButton
                icon="x"
                label={`Remove ${item}`}
                variant="plain"
                size={32}
                iconSize={16}
                style={styles.remove}
                onPress={() => onChange(value.filter((_, j) => j !== i))}
              />
            </View>
          ))}
        </ListGroup>
      ) : null}
      <View style={styles.addRow}>
        <View style={styles.addInput}>
          <Input value={adding} onChangeText={setAdding} placeholder={placeholder ?? "Add an item…"} onSubmitEditing={add} returnKeyType="done" />
        </View>
        <IconButton icon="plus" label="Add item" variant={ready ? "primary" : "solid"} shape="square" size={48} onPress={add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 46,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  index: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
  item: {
    ...type.body,
    flex: 1,
    paddingVertical: spacing.sm + 2,
    color: colors.foreground,
  },
  remove: {
    marginRight: -spacing.sm,
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
