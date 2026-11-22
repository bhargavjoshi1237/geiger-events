import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { fmtDate, fmtTimeAgo } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { TeamMember } from "@/types/control_team";

type Props = {
  member: TeamMember;
  isMe?: boolean;
  onPress?: () => void;
  divider?: boolean;
};

function dateLine(m: TeamMember): string {
  if (m.status === "invited") return m.invitedAt ? `Invited ${fmtDate(m.invitedAt)}` : "Invited";
  const joined = m.joinedAt ? `Joined ${fmtDate(m.joinedAt)}` : "";
  const ago = fmtTimeAgo(m.lastActiveAt);
  const seen = ago ? (ago === "Just now" ? "seen now" : `seen ${ago}`) : "";
  return [joined, seen].filter(Boolean).join(" · ");
}

// One person on the roster: avatar, name and email, their role capsule and mono joined/seen dates.
export function MemberRow({ member, isMe = false, onPress, divider = true }: Props) {
  const name = member.name || member.email;
  const role = member.roleName ?? "No role";
  const dates = dateLine(member);
  const body = (
    <>
      <Avatar name={member.name} email={member.email} size={40} />
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {isMe ? <Text style={styles.you}>You</Text> : null}
        </View>
        {member.name ? (
          <Text style={styles.email} numberOfLines={1}>
            {member.email}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <View style={[styles.role, !member.roleName && styles.roleMissing]}>
            <Text style={[styles.roleText, !member.roleName && styles.roleTextMissing]} numberOfLines={1}>
              {role}
            </Text>
          </View>
          {member.status === "suspended" ? <Pill label="Suspended" tone="warning" /> : null}
          {dates ? (
            <Text style={styles.dates} numberOfLines={1}>
              {dates}
            </Text>
          ) : null}
        </View>
      </View>
      {onPress ? <Icon name="chevron-right" size={18} color={colors.textTertiary} /> : null}
    </>
  );

  if (!onPress) return <View style={[styles.row, divider && styles.divided]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${role}${isMe ? ", you" : ""}. Change role`}
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
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    ...type.bodyStrong,
    flexShrink: 1,
    color: colors.foreground,
  },
  you: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  email: {
    ...type.caption,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 3,
  },
  role: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceActive,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    maxWidth: "50%",
  },
  roleMissing: {
    borderColor: `${colors.warning}59`,
    backgroundColor: `${colors.warning}1A`,
  },
  roleText: {
    ...type.captionStrong,
    fontSize: 11,
    lineHeight: 15,
    color: colors.foreground,
  },
  roleTextMissing: {
    color: colors.warning,
  },
  dates: {
    ...type.monoSmall,
    fontSize: 11,
    flexShrink: 1,
    color: colors.textTertiary,
  },
});
