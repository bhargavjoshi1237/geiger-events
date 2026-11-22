import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DateStub } from "@/components/control/DateStub";
import { EmptyState } from "@/components/ui/EmptyState";
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

const placeOf = (event: ControlEvent) => [event.venue, event.city].filter(Boolean).join(", ");

// Per-event reports open on today's or the next event, which is the first in the server's order.
export function EventPicker({ projectId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const list = useControlQuery<{ events: ControlEvent[] }>(`/api/control/projects/${projectId}/events`, { refetchOnFocus: false });
  const events = useMemo(() => list.data?.events ?? [], [list.data]);
  const selected = events.find((e) => e.id === value) ?? null;

  useEffect(() => {
    if (!value && events[0]) onChange(events[0]);
  }, [value, events, onChange]);

  if (list.loading && !list.data) return <Skeleton height={76} radius={radius.lg} />;
  if (!events.length) {
    return list.error ? (
      <EmptyState icon="circle-alert" title="Couldn't load events" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
    ) : (
      <EmptyState icon="calendar" title="No events yet" message="This report works per event. It fills in once the project has one." />
    );
  }

  const place = selected ? placeOf(selected) : "";

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
          <Text style={styles.kicker}>Event</Text>
          <Text style={styles.name} numberOfLines={1}>
            {selected?.name ?? "Choose an event"}
          </Text>
          {selected ? (
            <Text style={[styles.when, selected.when === "today" && styles.whenToday]} numberOfLines={1}>
              {eventDateLine(selected)}
              {place ? <Text style={styles.place}>{`  ${place}`}</Text> : null}
            </Text>
          ) : null}
        </View>
        <View style={styles.change}>
          <Icon name="chevrons-up-down" size={14} color={colors.mutedForeground} />
        </View>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Choose an event">
        <ListGroup footer="Today and upcoming first, then recent past events.">
          <ScrollView style={styles.list}>
            {events.map((event, i) => {
              const current = event.id === value;
              const where = placeOf(event);
              return (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  accessibilityLabel={`${event.name}, ${eventDateLine(event)}`}
                  onPress={() => {
                    selectionFeedback();
                    onChange(event);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.row, i < events.length - 1 && styles.divided, pressed && styles.pressed]}
                >
                  <DateStub date={event.date} today={event.when === "today"} muted={event.when === "past"} />
                  <View style={styles.stack}>
                    <Text style={[styles.name, event.when === "past" && styles.nameMuted]} numberOfLines={1}>
                      {event.name}
                    </Text>
                    <Text style={styles.when} numberOfLines={1}>
                      {eventDateLine(event)}
                    </Text>
                    {where ? (
                      <Text style={styles.place} numberOfLines={1}>
                        {where}
                      </Text>
                    ) : null}
                  </View>
                  {current ? <Icon name="check" size={18} color={colors.foreground} /> : null}
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
    gap: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.md + 2,
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
  kicker: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  name: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  nameMuted: {
    color: colors.mutedForeground,
  },
  when: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  whenToday: {
    color: colors.success,
  },
  place: {
    ...type.caption,
    color: colors.textSecondary,
  },
  change: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceActive,
  },
  list: {
    maxHeight: 420,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
});
