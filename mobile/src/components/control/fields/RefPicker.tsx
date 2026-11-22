import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { selectionFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlRecord } from "@/types/portal";

type Props = { refModule: string; projectId: string; value: string; onChange: (id: string) => void; label: string };

// A link to a sibling record (a session's speaker, a room's sponsor), picked from that module's records.
export function RefPicker({ refModule, projectId, value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = useControlQuery<{ records: ControlRecord[] }>(
    refModule ? `/api/control/projects/${projectId}/records/${refModule}` : null,
    { refetchOnFocus: false },
  );
  const records = list.data?.records ?? [];
  const selected = records.find((r) => r.id === value);
  const q = query.trim().toLowerCase();
  const shown = q ? records.filter((r) => r.name.toLowerCase().includes(q)) : records;

  const pick = (id: string) => {
    selectionFeedback();
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.name ?? "none"}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.name ?? (value ? "Linked record" : "None")}
        </Text>
        <Icon name="chevrons-up-down" size={16} color={colors.textTertiary} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.body}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search…" autoCapitalize="none" />
          {list.loading ? (
            <SkeletonList rows={3} variant="divided" />
          ) : (
            <ScrollView style={styles.group} keyboardShouldPersistTaps="handled">
              {[{ id: "", name: "None" }, ...shown].map((r, i, all) => (
                <Pressable
                  key={r.id || "none"}
                  accessibilityRole="button"
                  accessibilityState={{ selected: r.id === value }}
                  accessibilityLabel={r.name}
                  onPress={() => pick(r.id)}
                  style={({ pressed }) => [styles.row, i < all.length - 1 && styles.divided, pressed && styles.pressed]}
                >
                  <Text style={styles.rowText} numberOfLines={1}>
                    {r.name}
                  </Text>
                  {r.id === value ? <Icon name="check" size={18} color={colors.foreground} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  triggerText: {
    ...type.body,
    flex: 1,
    color: colors.foreground,
  },
  placeholder: {
    color: colors.textTertiary,
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    gap: spacing.md,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    maxHeight: 360,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  rowText: {
    ...type.body,
    flex: 1,
    color: colors.foreground,
  },
});
