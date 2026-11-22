import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { PulseDot } from "@/components/ui/PulseDot";
import { TickMeter } from "@/components/ui/TickMeter";
import { eventStatusMeta } from "@/lib/control_meta";
import { tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEvent } from "@/types/portal";

type Props = {
  event: ControlEvent;
  onOpen: () => void;
  onCheckIn?: () => void;
};

// An event that's on today: cover band, door time, sold on the tick scale and the check-in action up front.
export function TodayEventCard({ event, onOpen, onCheckIn }: Props) {
  const status = eventStatusMeta(event.status);
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  const left = event.capacity > 0 ? Math.max(0, event.capacity - event.sold) : null;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${event.name}`}
        onPress={() => {
          tapFeedback();
          onOpen();
        }}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {event.coverUrl ? (
          <View style={styles.band}>
            <Image source={{ uri: event.coverUrl }} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={[colors.canvasClear, colors.surfaceSubtle]} locations={[0.25, 1]} style={StyleSheet.absoluteFill} />
          </View>
        ) : null}
        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={styles.live}>
              <PulseDot size={7} />
              <Text style={styles.kicker}>{event.time ? `Today · ${event.time.slice(0, 5)}` : "Today"}</Text>
            </View>
            <Pill label={status.label} tone={status.tone} />
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {event.name}
          </Text>
          {place ? (
            <Text style={styles.place} numberOfLines={1}>
              {place}
            </Text>
          ) : null}
          {event.capacity > 0 ? (
            <View style={styles.meterBlock}>
              <View style={styles.meterHead}>
                <Text style={styles.meterLabel}>Sold</Text>
                <Text style={styles.meterValue}>
                  {event.sold}
                  <Text style={styles.meterOf}>{` / ${event.capacity}`}</Text>
                </Text>
              </View>
              <TickMeter value={event.sold} max={event.capacity} label={`${event.sold} of ${event.capacity} sold`} />
              <Text style={styles.meterFoot}>{left === 0 ? "At capacity" : `${left} left`}</Text>
            </View>
          ) : (
            <Text style={styles.place}>{`${event.sold} sold`}</Text>
          )}
        </View>
      </Pressable>
      <View style={styles.actions}>
        {onCheckIn ? (
          <View style={styles.primary}>
            <Button title="Check in guests" icon="scan-line" onPress={onCheckIn} fullWidth />
          </View>
        ) : null}
        <View style={onCheckIn ? null : styles.primary}>
          <Button title={onCheckIn ? "Open" : "Open event"} variant="secondary" onPress={onOpen} fullWidth={!onCheckIn} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSubtle,
  },
  pressed: {
    opacity: 0.8,
  },
  band: {
    height: 120,
    backgroundColor: colors.surfaceCard,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.xs + 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  kicker: {
    ...type.kicker,
    textTransform: "uppercase",
    color: colors.success,
  },
  name: {
    ...type.title,
    fontSize: 21,
    lineHeight: 26,
    color: colors.foreground,
  },
  place: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  meterBlock: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  meterHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  meterLabel: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  meterValue: {
    ...type.figureSmall,
    color: colors.foreground,
  },
  meterOf: {
    color: colors.textTertiary,
  },
  meterFoot: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  primary: {
    flex: 1,
  },
});
