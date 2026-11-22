import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ListGroup } from "@/components/ui/ListGroup";
import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  subject: string;
  onSubjectChange: (next: string) => void;
  subjectMax: number;
  subjectPlaceholder?: string;
  body: string;
  onBodyChange: (next: string) => void;
  bodyMax: number;
  bodyPlaceholder?: string;
  footer?: string;
};

// A document-style composer: a subject line over the message body in one panel, with a live character count.
export function MessageComposer({ subject, onSubjectChange, subjectMax, subjectPlaceholder, body, onBodyChange, bodyMax, bodyPlaceholder, footer }: Props) {
  const nearLimit = body.length >= bodyMax * 0.9;
  return (
    <ListGroup title="Message" footer={footer} flush>
      <View style={styles.subjectRow}>
        <Text style={styles.prefix}>Subject</Text>
        <TextInput
          value={subject}
          onChangeText={onSubjectChange}
          placeholder={subjectPlaceholder}
          placeholderTextColor={colors.textTertiary}
          maxLength={subjectMax}
          returnKeyType="next"
          accessibilityLabel="Subject, optional"
          style={styles.subject}
        />
      </View>
      <TextInput
        value={body}
        onChangeText={onBodyChange}
        placeholder={bodyPlaceholder}
        placeholderTextColor={colors.textTertiary}
        maxLength={bodyMax}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Message"
        style={styles.body}
      />
      <View style={styles.foot}>
        <Text style={styles.footNote}>Subject is optional</Text>
        <Text style={[styles.count, nearLimit && styles.countNear]}>
          {body.length}
          <Text style={styles.countOf}>{` / ${bodyMax}`}</Text>
        </Text>
      </View>
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  prefix: {
    ...type.label,
    color: colors.textTertiary,
  },
  subject: {
    ...type.bodyStrong,
    flex: 1,
    minHeight: 48,
    color: colors.foreground,
  },
  body: {
    ...type.body,
    minHeight: 200,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md + 2,
    paddingBottom: spacing.md,
    color: colors.foreground,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceActive,
  },
  footNote: {
    ...type.caption,
    color: colors.textTertiary,
  },
  count: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  countNear: {
    color: colors.warning,
  },
  countOf: {
    color: colors.textTertiary,
  },
});
