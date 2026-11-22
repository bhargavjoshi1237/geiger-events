import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { fmtCompactTime } from "@/lib/format";
import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  name: string;
  at?: string | null;
  // Organisers get an inverted avatar and a tag, so staff posts stand out in a member thread.
  organiser?: boolean;
  context?: string;
  size?: number;
  trailing?: React.ReactNode;
};

// Who wrote it and when: avatar, name, an optional context line and a compact mono timestamp.
export function Byline({ name, at, organiser = false, context, size = 32, trailing }: Props) {
  const when = fmtCompactTime(at);
  return (
    <View style={styles.row}>
      <Avatar name={name} size={size} inverted={organiser} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name || "Member"}
          </Text>
          {organiser ? <Text style={styles.tag}>Organiser</Text> : null}
        </View>
        {context ? (
          <Text style={styles.context} numberOfLines={1}>
            {context}
          </Text>
        ) : null}
      </View>
      {trailing}
      {when ? <Text style={styles.time}>{when}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    ...type.labelStrong,
    flexShrink: 1,
    color: colors.foreground,
  },
  tag: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  context: {
    ...type.caption,
    color: colors.textSecondary,
  },
  time: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
