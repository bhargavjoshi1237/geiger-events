import React, { useEffect, useState } from "react";
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

// Picks one of the project's events; starts on the first (today's, else the soonest) so the screen is useful at once.
export function EventPicker({ projectId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const list = useControlQuery<{ events: ControlEvent[] }>(`/api/control/projects/${projectId}/events`, { refetchOnFocus: false });
  const events = list.data?.events ?? [];
  const selected = events.find((e) => e.id === value) ?? null;
  const first = events[0];

  useEffect(() => {
    if (!value && first) onChange(first);
  }, [value, first, onChange]);

  if (list.loading && !list.data) return <Skeleton height={52} radius={radius.lg} />;
  if (!events.length) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Event: ${selected?.name ?? "choose one"}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Icon name="calendar" size={16} color={colors.textSecondary} />
        <View style={styles.triggerStack}>
          <Text style={styles.triggerName} numberOfLines={1}>
            {selected?.name ?? "Choose an event"}
          </Text>
          {selected ? <Text style={styles.triggerMeta}>{whenLabel(selected)}</Text> : null}
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
              <View style={styles.triggerStack}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {event.name}
                </Text>
                <Text style={styles.triggerMeta}>{whenLabel(event)}</Text>
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
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  triggerStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  triggerName: {
    ...type.label,
    color: colors.foreground,
  },
  triggerMeta: {
    ...type.caption,
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
  rowName: {
    ...type.label,
    fontSize: 15,
    color: colors.foreground,
  },
});
