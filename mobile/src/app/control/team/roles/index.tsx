import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text } from "react-native";

import { Group } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamRoleList } from "@/types/control_team";

export default function RolesScreen() {
  const router = useRouter();
  const { project } = useControl();
  const list = useControlQuery<TeamRoleList>(project ? `/api/control/team/${project.id}/roles` : null);
  const data = list.data;

  return (
    <Screen scroll header={<ScreenHeader title="Roles & Permissions" />}>
      {data && !data.canManage ? <Text style={styles.note}>Your role can see roles but not change them.</Text> : null}
      {list.error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't load roles" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !data ? (
        <SkeletonList rows={5} variant="divided" />
      ) : !data.roles.length ? (
        <EmptyState icon="shield" title="No roles yet" message="Open Roles & Permissions on the dashboard once to set up the standard roles." />
      ) : (
        <Group>
          {data.roles.map((role, i) => (
            <ListRow
              key={role.id}
              leading={<IconTile icon={role.isOwner ? "shield-check" : "shield"} size={34} tone={role.isOwner ? "success" : "neutral"} />}
              title={role.name}
              subtitle={`${role.granted} of ${data.total} permissions · ${role.memberCount} ${pluralize(role.memberCount, "person", "people")}`}
              trailing={role.isSystem ? <Pill label="System" tone="neutral" variant="outline" dot={false} /> : undefined}
              onPress={() => router.push({ pathname: "/control/team/roles/[id]", params: { id: role.id } })}
              divider={i < data.roles.length - 1}
            />
          ))}
        </Group>
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
