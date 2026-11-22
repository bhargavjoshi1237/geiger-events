import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Notice } from "@/components/control/team/Notice";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, selectionFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { TeamRoleDetail } from "@/types/control_team";

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function RoleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project } = useControl();
  const toast = useToast();
  const path = project ? `/api/control/team/${project.id}/roles/${id}` : null;
  const detail = useControlQuery<TeamRoleDetail>(path);
  const [saving, setSaving] = useState<string | null>(null);
  const data = detail.data;
  const locked = !data?.canManage || data.role.isOwner;

  // One switch at a time, applied as soon as it's flipped, like the dashboard's matrix.
  const toggle = async (key: string, on: boolean) => {
    if (!path || locked || saving) return;
    selectionFeedback();
    setSaving(key);
    const res = await controlApi<TeamRoleDetail>(path, { method: "PATCH", body: { key, on } });
    setSaving(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    detail.setData(res.data);
  };

  let body: React.ReactNode;
  if (detail.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load this role" message={detail.error} actionLabel="Try again" onAction={() => void detail.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={8} variant="divided" />;
  } else {
    const { role } = data;
    const total = data.groups.reduce((n, g) => n + g.permissions.length, 0);
    const granted = data.groups.reduce((n, g) => n + g.permissions.filter((p) => p.granted).length, 0);
    const kind = role.isOwner ? "Owner" : role.isSystem ? "System role" : "Custom role";
    let step = 0;

    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
          <View style={styles.heroTop}>
            <IconTile icon={role.isOwner ? "shield-check" : "shield"} size={56} />
            <View style={styles.heroText}>
              <Text style={styles.name} numberOfLines={2}>
                {role.name}
              </Text>
              <View style={styles.metaRow}>
                <Pill label={kind} tone="neutral" variant="outline" dot={false} />
                <Text style={styles.meta} numberOfLines={1}>
                  {`${role.memberCount} ${pluralize(role.memberCount, "person", "people")}`}
                </Text>
              </View>
            </View>
          </View>
          {role.description ? <Text style={styles.description}>{role.description}</Text> : null}
          {total > 0 ? (
            <View style={styles.meterBlock}>
              <View style={styles.meterHead}>
                <Text style={styles.meterLabel}>Permissions granted</Text>
                <Text style={styles.meterValue}>
                  {granted}
                  <Text style={styles.meterOf}>{` / ${total}`}</Text>
                </Text>
              </View>
              <TickMeter value={granted} max={total} ticks={44} height={14} tone="neutral" label={`${granted} of ${total} permissions granted`} />
            </View>
          ) : null}
        </Animated.View>

        {role.isOwner ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Notice text="Owner always has every permission, so it can't be edited." />
          </Animated.View>
        ) : !data.canManage ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Notice text="Your role can see these permissions but not change them." />
          </Animated.View>
        ) : null}

        {data.groups.map((group) => {
          const on = group.permissions.filter((p) => p.granted).length;
          return (
            <Animated.View key={group.group} entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title={group.group} action={<CountBadge value={`${on}/${group.permissions.length}`} />}>
                {group.permissions.map((p, i) => (
                  <ListRow
                    key={p.key}
                    title={p.label}
                    trailing={<Switch value={p.granted} onValueChange={(next) => void toggle(p.key, next)} label={p.label} disabled={locked || saving !== null} />}
                    divider={i < group.permissions.length - 1}
                  />
                ))}
              </ListGroup>
            </Animated.View>
          );
        })}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Role" />}>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  description: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  meterBlock: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
  },
  meterHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  meterLabel: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  meterValue: {
    ...type.figureSmall,
    color: colors.foreground,
  },
  meterOf: {
    color: colors.textTertiary,
  },
});
