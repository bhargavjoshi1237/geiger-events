import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, type } from "@/theme/tokens";

type Props = {
  date: string | null;
  today?: boolean;
  muted?: boolean;
  size?: "md" | "lg";
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Read the calendar date off the string itself: new Date("2026-12-06") is UTC midnight and shows the day before west of UTC.
function parts(date: string | null): { month: string; day: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? { month, day: String(Number(m[3])) } : null;
}

// The ticket-stub date that leads every event row: month over a mono day number.
export function DateStub({ date, today = false, muted = false, size = "md" }: Props) {
  const p = parts(date);
  const large = size === "lg";
  return (
    <View
      style={[styles.stub, large && styles.large, today && styles.today, muted && styles.muted]}
      accessible
      accessibilityLabel={today ? "Today" : p ? `${p.month} ${p.day}` : "No date yet"}
    >
      <Text style={[styles.month, today && styles.monthToday]}>{today ? "Today" : p ? p.month : "Date"}</Text>
      <Text style={[styles.day, large && styles.dayLarge, muted && styles.dayMuted]}>{p ? p.day : "–"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stub: {
    width: 46,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceActive,
  },
  large: {
    width: 56,
    height: 62,
    borderRadius: radius.md + 2,
  },
  today: {
    borderColor: `${colors.success}59`,
    backgroundColor: `${colors.success}14`,
  },
  muted: {
    backgroundColor: colors.surfaceSubtle,
  },
  month: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  monthToday: {
    color: colors.success,
  },
  day: {
    ...type.figureSmall,
    fontSize: 19,
    lineHeight: 23,
    color: colors.foreground,
  },
  dayLarge: {
    fontSize: 24,
    lineHeight: 28,
  },
  dayMuted: {
    color: colors.textSecondary,
  },
});
