import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { colors, spacing, type } from "@/theme/tokens";

export type Reading = { ok: boolean; text: string };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Typed YYYY-MM-DD / HH:MM read back as a calendar day, or what's off about the format; nothing while both are blank.
export function readDate(date: string, time = ""): Reading | null {
  const d = date.trim();
  const t = time.trim();
  if (!d && !t) return null;
  let day: Date | null = null;
  if (d) {
    const m = DATE.exec(d);
    const parsed = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    // new Date rolls Feb 30 into March, so the parts must survive the round trip.
    if (!m || !parsed || parsed.getMonth() !== Number(m[2]) - 1 || parsed.getDate() !== Number(m[3])) {
      return { ok: false, text: "Write the date as YYYY-MM-DD" };
    }
    day = parsed;
  }
  if (t && !TIME.test(t)) return { ok: false, text: "Write the time as HH:MM, 24-hour" };
  const label = day ? day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "No date yet";
  return { ok: true, text: [label, t].filter(Boolean).join(" · ") };
}

// One line under a date input: the day it reads as, or a warning about the format.
export function Readback({ reading }: { reading: Reading }) {
  return (
    <View style={styles.row} accessible accessibilityLiveRegion="polite" accessibilityLabel={reading.text}>
      <Icon name={reading.ok ? "calendar-check" : "circle-alert"} size={13} color={reading.ok ? colors.textSecondary : colors.warning} />
      <Text style={reading.ok ? styles.ok : styles.bad} numberOfLines={1}>
        {reading.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  ok: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.mutedForeground,
  },
  bad: {
    ...type.caption,
    flexShrink: 1,
    color: colors.warning,
  },
});
