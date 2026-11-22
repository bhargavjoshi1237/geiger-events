import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DateStub } from "@/components/control/DateStub";
import { Icon } from "@/components/ui/icons";
import { ListGroup } from "@/components/ui/ListGroup";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { eventDateLine } from "@/lib/control_meta";
import { selectionFeedback, tapFeedback } from "@/lib/haptics";
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

  if (list.loading && !list.data) return <Skeleton height={74} radius={radius.lg} />;
  if (!events.length) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Event: ${selected?.name ?? "choose one"}. Change event`}
        onPress={() => {
          tapFeedback();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <DateStub date={selected?.date ?? null} today={selected?.when === "today"} muted={selected?.when === "past"} />
        <View style={styles.stack}>
          <Text style={styles.name} numberOfLines={1}>
            {selected?.name ?? "Choose an event"}
          </Text>
          {selected ? (
            <Text style={[styles.when, selected.when === "today" && styles.whenToday]} numberOfLines={1}>
              {eventDateLine(selected)}
            </Text>
          ) : null}
        </View>
        <Icon name="chevrons-up-down" size={16} color={colors.textTertiary} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Choose an event">
        <ListGroup>
          <ScrollView style={styles.list}>
            {events.map((event, i) => {
              const place = [event.venue, event.city].filter(Boolean).join(", ");
              return (
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
                  <DateStub date={event.date} today={event.when === "today"} muted={event.when === "past"} />
                  <View style={styles.stack}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {event.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[eventDateLine(event), place].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {event.id === value ? <Icon name="check" size={18} color={colors.foreground} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </ListGroup>
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
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  when: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  whenToday: {
    color: colors.success,
  },
  list: {
    maxHeight: 420,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  rowName: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  meta: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
