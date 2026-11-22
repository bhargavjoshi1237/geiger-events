import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Notice } from "@/components/control/team/Notice";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { pluralize } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamRole, TeamRoleList } from "@/types/control_team";

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function RolesScreen() {
  const router = useRouter();
  const { project } = useControl();
  const list = useControlQuery<TeamRoleList>(project ? `/api/control/team/${project.id}/roles` : null);
  const data = list.data;
  let step = 0;

  let body: React.ReactNode;
  if (list.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load roles" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!data.roles.length) {
    body = <EmptyState icon="shield" title="No roles yet" message="Open Roles & Permissions on the dashboard once to set up the standard roles." />;
  } else {
    const people = data.roles.reduce((n, r) => n + r.memberCount, 0);
    const custom = data.roles.filter((r) => !r.isSystem).length;
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Readout
            items={[
              { label: "Roles", value: String(data.roles.length) },
              { label: "Custom", value: String(custom) },
              { label: "Permissions", value: String(data.total) },
              { label: "People", value: String(people) },
            ]}
          />
        </Animated.View>
        {!data.canManage ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Notice text="Your role can see roles but not change them." />
          </Animated.View>
        ) : null}
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Roles in this project" footer="Each bar shows how many of the project's permissions a role holds.">
            {data.roles.map((role, i) => (
              <RoleRow
                key={role.id}
                role={role}
                total={data.total}
                onPress={() => router.push({ pathname: "/control/team/roles/[id]", params: { id: role.id } })}
                divider={i < data.roles.length - 1}
              />
            ))}
          </ListGroup>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Roles & Permissions" />}>
      {body}
    </Screen>
  );
}

// A role with how much of the permission set it holds on the tick scale, like an event's sold bar.
function RoleRow({ role, total, onPress, divider }: { role: TeamRole; total: number; onPress: () => void; divider: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${role.name}, ${role.granted} of ${total} permissions, ${role.memberCount} ${pluralize(role.memberCount, "person", "people")}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      <IconTile icon={role.isOwner ? "shield-check" : "shield"} size={36} />
      <View style={styles.rowStack}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {role.name}
          </Text>
          {role.isOwner ? (
            <Pill label="Owner" tone="neutral" variant="outline" dot={false} />
          ) : role.isSystem ? (
            <Pill label="System" tone="neutral" variant="outline" dot={false} />
          ) : null}
        </View>
        <Text style={styles.people}>{`${role.memberCount} ${pluralize(role.memberCount, "person", "people")}`}</Text>
        {total > 0 ? (
          <View style={styles.meterRow}>
            <View style={styles.meter}>
              <TickMeter value={role.granted} max={total} ticks={30} height={9} tone="neutral" label={`${role.granted} of ${total} permissions`} />
            </View>
            <Text style={styles.count}>
              {role.granted}
              <Text style={styles.countOf}>{`/${total}`}</Text>
            </Text>
          </View>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
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
  rowStack: {
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
  people: {
    ...type.monoSmall,
    fontSize: 11,
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
