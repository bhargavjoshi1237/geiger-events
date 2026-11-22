import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { tapFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";
import type { GuestContact } from "@/types/control_guests";

type Props = {
  contact: GuestContact;
  onPress: () => void;
  divider?: boolean;
  // Pickers hide the tag chips so a search result stays one tight line.
  showTags?: boolean;
};

const TAG_LIMIT = 3;

// An address-book entry: initials, name, email and company, the first few tags and a mono note count.
export function ContactRow({ contact, onPress, divider = true, showTags = true }: Props) {
  const name = contact.name || contact.email || "Unnamed";
  const line = [contact.name ? contact.email : "", contact.company].filter(Boolean).join(" · ");
  const tags = showTags ? contact.tags.slice(0, TAG_LIMIT) : [];
  const more = showTags ? contact.tags.length - tags.length : 0;
  const notes = contact.notes.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, contact.blocked ? "blocked" : "", line].filter(Boolean).join(", ")}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      <Avatar name={contact.name} email={contact.email} size={40} />
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {contact.blocked ? <Pill label="Blocked" tone="danger" /> : null}
        </View>
        {line ? (
          <Text style={styles.line} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Pill key={tag} label={tag} tone="neutral" variant="outline" dot={false} />
            ))}
            {more > 0 ? <Text style={styles.more}>{`+${more}`}</Text> : null}
          </View>
        ) : null}
      </View>
      {notes ? (
        <View style={styles.notes} accessible accessibilityLabel={`${notes} ${notes === 1 ? "note" : "notes"}`}>
          <Icon name="file-text" size={12} color={colors.textTertiary} />
          <Text style={styles.notesCount}>{notes}</Text>
        </View>
      ) : null}
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md + 1,
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
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    ...type.labelStrong,
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
    color: colors.foreground,
  },
  line: {
    ...type.caption,
    color: colors.textSecondary,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginTop: 3,
  },
  more: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
  notes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  notesCount: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
