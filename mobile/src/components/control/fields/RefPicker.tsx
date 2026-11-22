import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { pluralize } from "@/lib/format";
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
  const rows = [{ id: "", name: "None" }, ...shown];

  const pick = (id: string) => {
    selectionFeedback();
    onChange(id);
    setOpen(false);
  };

  let body: React.ReactNode;
  if (list.loading && !list.data) {
    body = <SkeletonList rows={3} variant="divided" />;
  } else if (list.error && !list.data) {
    body = (
      <View style={styles.error}>
        <Text style={styles.errorText}>{list.error}</Text>
        <Button title="Try again" size="sm" variant="secondary" icon="refresh-cw" onPress={() => void list.reload()} />
      </View>
    );
  } else {
    body = (
      <ListGroup title={q ? `${shown.length} ${pluralize(shown.length, "match", "matches")}` : `${records.length} to choose from`}>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          {rows.map((r, i) => {
            const current = r.id === value;
            const none = !r.id;
            return (
              <Pressable
                key={r.id || "none"}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                accessibilityLabel={none ? `No ${label.toLowerCase()}` : r.name}
                onPress={() => pick(r.id)}
                style={({ pressed }) => [styles.row, i < rows.length - 1 && styles.divided, pressed && styles.pressed]}
              >
                <Text style={[styles.rowText, none && styles.rowNone, current && styles.rowCurrent]} numberOfLines={1}>
                  {r.name}
                </Text>
                {current ? <Icon name="check" size={18} color={colors.foreground} /> : null}
              </Pressable>
            );
          })}
          {q && !shown.length ? <Text style={styles.noMatch}>{`Nothing called “${query.trim()}”.`}</Text> : null}
        </ScrollView>
      </ListGroup>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.name ?? "none"}. Change`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Icon name="link" size={16} color={selected ? colors.mutedForeground : colors.textTertiary} />
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.name ?? (value ? "Linked record" : "None")}
        </Text>
        <Icon name="chevrons-up-down" size={16} color={colors.textTertiary} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.body}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search by name…" autoCapitalize="none" autoCorrect={false} />
          {body}
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
    gap: spacing.sm + 2,
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
    gap: spacing.lg,
  },
  scroll: {
    maxHeight: 360,
  },
  row: {
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
  rowText: {
    ...type.body,
    flex: 1,
    color: colors.foreground,
  },
  rowNone: {
    color: colors.textSecondary,
  },
  rowCurrent: {
    ...type.bodyStrong,
  },
  noMatch: {
    ...type.caption,
    color: colors.textTertiary,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  error: {
    alignItems: "flex-start",
    gap: spacing.md,
  },
  errorText: {
    ...type.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
