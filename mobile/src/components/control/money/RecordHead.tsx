import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { DateStub } from "@/components/control/DateStub";
import { StatusButton } from "@/components/control/StatusButton";
import { localDay, todayKey } from "@/components/control/money/ledger";
import type { StatusMeta } from "@/lib/status";
import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  // When the record came in, as an ISO timestamp.
  at: string | null;
  title: string;
  subtitle?: string;
  amount?: string;
  status: StatusMeta;
};

// The top of a money record's sheet: the day it came in, who, its status and the amount as a mono figure.
export function RecordHead({ at, title, subtitle, amount, status }: Props) {
  const day = localDay(at);
  return (
    <View style={styles.head}>
      <DateStub date={day} today={Boolean(day) && day === todayKey()} />
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {amount ? (
            <Text style={styles.amount} numberOfLines={1}>
              {amount}
            </Text>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.status}>
          <StatusButton label={status.label} tone={status.tone} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md + 2,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
  },
  title: {
    ...type.heading,
    flex: 1,
    color: colors.foreground,
  },
  amount: {
    ...type.figureSmall,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  subtitle: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  status: {
    marginTop: spacing.sm,
  },
});
