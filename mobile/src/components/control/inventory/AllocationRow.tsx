import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ALLOCATION_META, qtyText } from "@/components/control/inventory/meta";
import { Icon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { TickMeter } from "@/components/ui/TickMeter";
import { tapFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";
import type { AllocationStatus } from "@/types/control_inventory";

type Props = {
  title: string;
  subtitle?: string;
  issued: number;
  planned: number;
  status: AllocationStatus;
  onPress?: () => void;
  divider?: boolean;
};

// Stock committed to an event: issued against planned on the tick scale, with its allocation status.
export function AllocationRow({ title, subtitle, issued, planned, status, onPress, divider = true }: Props) {
  const meta = ALLOCATION_META[status] ?? { label: status, tone: "neutral" as const };
  const body = (
    <>
      <View style={styles.stack}>
        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pill label={meta.label} tone={meta.tone} variant="outline" />
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {planned > 0 ? (
          <View style={styles.meterRow}>
            <View style={styles.meter}>
              <TickMeter
                value={issued}
                max={planned}
                ticks={30}
                height={9}
                tone={status === "Closed" ? "neutral" : "success"}
                label={`${qtyText(issued)} of ${qtyText(planned)} issued`}
              />
            </View>
            <Text style={styles.count}>
              {qtyText(issued)}
              <Text style={styles.countOf}>{`/${qtyText(planned)}`}</Text>
            </Text>
          </View>
        ) : (
          <Text style={styles.count}>
            {qtyText(issued)}
            <Text style={styles.countOf}> issued</Text>
          </Text>
        )}
      </View>
      {onPress ? <Icon name="chevron-right" size={18} color={colors.textTertiary} /> : null}
    </>
  );

  if (!onPress) return <View style={[styles.row, divider && styles.divided]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${qtyText(issued)} of ${qtyText(planned)} issued, ${meta.label}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  pressed: {
    opacity: 0.6,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    ...type.labelStrong,
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
    color: colors.foreground,
  },
  subtitle: {
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
