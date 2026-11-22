import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DateStub } from "@/components/control/DateStub";
import { todayKey } from "@/components/control/money/ledger";
import { TONE_COLOR } from "@/components/control/money/meta";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Pill } from "@/components/ui/Pill";
import { tapFeedback } from "@/lib/haptics";
import type { StatusMeta, Tone } from "@/lib/status";
import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  title: string;
  meta?: string;
  // The leading column: a mono time in day-grouped ledgers, a date stub in dated queues, otherwise an icon tile.
  time?: string;
  date?: string | null;
  icon?: IconName;
  // A reference code, set in mono at the end of the meta line.
  code?: string;
  amount?: string;
  amountTone?: "default" | "negative" | "void";
  status?: StatusMeta | null;
  // A deadline or alert under the meta line, e.g. when dispute evidence is due.
  flag?: { label: string; tone: Tone; icon?: IconName } | null;
  onPress?: () => void;
  divider: boolean;
};

// A ledger line: who and what on the left, the amount in a right-aligned mono column with its status under it.
export function MoneyRow({ title, meta, time, date, icon, code, amount, amountTone = "default", status, flag, onPress, divider }: Props) {
  const timed = time !== undefined;
  const leading = timed ? (
    <Text style={styles.time}>{time || "–"}</Text>
  ) : date !== undefined ? (
    <DateStub date={date} today={Boolean(date) && date === todayKey()} />
  ) : icon ? (
    <IconTile icon={icon} size={36} />
  ) : null;

  const body = (
    <>
      {leading}
      <View style={styles.stack}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {meta || code ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
            {meta && code ? " · " : ""}
            {code ? <Text style={styles.code}>{code}</Text> : null}
          </Text>
        ) : null}
        {flag ? (
          <View style={styles.flag}>
            <Icon name={flag.icon ?? "clock"} size={12} color={TONE_COLOR[flag.tone]} />
            <Text style={[styles.flagText, { color: TONE_COLOR[flag.tone] }]} numberOfLines={1}>
              {flag.label}
            </Text>
          </View>
        ) : null}
      </View>
      {amount || status ? (
        <View style={styles.trailing}>
          {amount ? (
            <Text style={[styles.amount, amountTone === "negative" && styles.negative, amountTone === "void" && styles.void]} numberOfLines={1}>
              {amount}
            </Text>
          ) : null}
          {status ? <Pill label={status.label} tone={status.tone} variant="outline" /> : null}
        </View>
      ) : null}
    </>
  );

  const frame = [styles.row, timed ? styles.top : styles.center, divider && styles.divided];
  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, amount, status?.label].filter(Boolean).join(", ")}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [...frame, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  top: {
    alignItems: "flex-start",
  },
  center: {
    alignItems: "center",
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  time: {
    ...type.monoSmall,
    width: 40,
    // Sits on the title's first line: 20pt title line against a 16pt mono line.
    paddingTop: 2,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  code: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  flag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  flagText: {
    ...type.captionStrong,
    flexShrink: 1,
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6,
    maxWidth: 150,
  },
  amount: {
    ...type.mono,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  negative: {
    color: colors.info,
  },
  void: {
    color: colors.textTertiary,
    textDecorationLine: "line-through",
  },
});
