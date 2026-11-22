import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Group } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, selectionFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamRoleDetail } from "@/types/control_team";

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

  return (
    <Screen scroll header={<ScreenHeader title={data?.role.name ?? "Role"} subtitle={data ? `${data.role.granted} permissions` : undefined} />}>
      {detail.error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't load this role" message={detail.error} actionLabel="Try again" onAction={() => void detail.reload()} />
      ) : !data ? (
        <SkeletonList rows={8} variant="divided" />
      ) : (
        <View>
          {data.role.description ? <Text style={styles.note}>{data.role.description}</Text> : null}
          {data.role.isOwner ? (
            <Text style={styles.note}>{"Owner always has every permission, so it can't be edited."}</Text>
          ) : !data.canManage ? (
            <Text style={styles.note}>Your role can see these permissions but not change them.</Text>
          ) : null}
          {data.groups.map((group) => (
            <View key={group.group}>
              <SectionTitle variant="kicker">{group.group}</SectionTitle>
              <Group>
                {group.permissions.map((p, i) => (
                  <ListRow
                    key={p.key}
                    title={p.label}
                    trailing={
                      <Switch value={p.granted} onValueChange={(on) => void toggle(p.key, on)} label={p.label} disabled={locked || saving !== null} />
                    }
                    divider={i < group.permissions.length - 1}
                  />
                ))}
              </Group>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
