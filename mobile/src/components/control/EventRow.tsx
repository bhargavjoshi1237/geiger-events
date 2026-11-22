import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DateStub } from "@/components/control/DateStub";
import { Icon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { TickMeter } from "@/components/ui/TickMeter";
import { eventStatusMeta } from "@/lib/control_meta";
import { tapFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";
import type { ControlEvent } from "@/types/portal";

type Props = {
  event: ControlEvent;
  onPress: () => void;
  divider?: boolean;
};

// An event in a list: date stub, name, where and when, and sold against capacity on the tick scale.
export function EventRow({ event, onPress, divider = true }: Props) {
  const status = eventStatusMeta(event.status);
  const time = event.time ? event.time.slice(0, 5) : "";
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  const line = [event.when === "unscheduled" ? "No date yet" : time, place].filter(Boolean).join(" · ");
  const past = event.when === "past";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${status.label}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      <DateStub date={event.date} today={event.when === "today"} muted={past} />
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, past && styles.nameMuted]} numberOfLines={1}>
            {event.name}
          </Text>
          <Pill label={status.label} tone={status.tone} variant="outline" />
        </View>
        {line ? (
          <Text style={styles.line} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
        {event.capacity > 0 ? (
          <View style={styles.meterRow}>
            <View style={styles.meter}>
              <TickMeter value={event.sold} max={event.capacity} ticks={30} height={9} tone={past ? "neutral" : "success"} label={`${event.sold} of ${event.capacity} sold`} />
            </View>
            <Text style={styles.count}>
              {event.sold}
              <Text style={styles.countOf}>/{event.capacity}</Text>
            </Text>
          </View>
        ) : event.sold > 0 ? (
          <Text style={styles.count}>
            {event.sold}
            <Text style={styles.countOf}> sold</Text>
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  nameMuted: {
    color: colors.mutedForeground,
  },
  line: {
    ...type.caption,
    color: colors.textSecondary,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginTop: 3,
  },
  meter: {
    flex: 1,
  },
  count: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.foreground,
  },
  countOf: {
    color: colors.textTertiary,
  },
});
