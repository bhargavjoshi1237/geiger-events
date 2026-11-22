import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { whenLabel } from "@/lib/control_meta";
import { selectionFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEvent } from "@/types/portal";

type Props = { projectId: string; value: string | null; onChange: (event: ControlEvent) => void };

// Per-event reports open on today's or the next event, which is the first in the server's order.
export function EventPicker({ projectId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const list = useControlQuery<{ events: ControlEvent[] }>(`/api/control/projects/${projectId}/events`, { refetchOnFocus: false });
  const events = useMemo(() => list.data?.events ?? [], [list.data]);
  const selected = events.find((e) => e.id === value) ?? null;

  useEffect(() => {
    if (!value && events[0]) onChange(events[0]);
  }, [value, events, onChange]);

  if (list.loading && !list.data) return <Skeleton height={56} radius={radius.lg} />;
  if (!events.length) return <Text style={styles.empty}>{list.error ?? "This project has no events yet."}</Text>;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Event: ${selected?.name ?? "choose one"}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <View style={styles.stack}>
          <Text style={styles.name} numberOfLines={1}>
            {selected?.name ?? "Choose an event"}
          </Text>
          {selected ? <Text style={styles.meta}>{whenLabel(selected)}</Text> : null}
        </View>
        <Icon name="chevrons-up-down" size={16} color={colors.textTertiary} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Event">
        <ScrollView style={styles.list}>
          {events.map((event, i) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityState={{ selected: event.id === value }}
              accessibilityLabel={event.name}
              onPress={() => {
                selectionFeedback();
                onChange(event);
                setOpen(false);
              }}
              style={({ pressed }) => [styles.row, i < events.length - 1 && styles.divided, pressed && styles.pressed]}
            >
              <View style={styles.stack}>
                <Text style={styles.name} numberOfLines={1}>
                  {event.name}
                </Text>
                <Text style={styles.meta}>{whenLabel(event)}</Text>
              </View>
              {event.id === value ? <Icon name="check" size={18} color={colors.foreground} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...type.label,
    fontSize: 15,
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  empty: {
    ...type.body,
    color: colors.textSecondary,
  },
  list: {
    maxHeight: 420,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
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
});
