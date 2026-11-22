import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { eventStatusMeta } from "@/lib/control_meta";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing } from "@/theme/tokens";
import type { OpsSeries } from "@/types/control_ops";

export default function SeriesScreen() {
  const router = useRouter();
  const { project } = useControl();
  const list = useControlQuery<{ series: OpsSeries[] }>(project ? `/api/control/ops/projects/${project.id}/series` : null);
  const series = list.data?.series ?? [];

  return (
    <Screen scroll header={<ScreenHeader title="Event series" />}>
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load series" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={5} variant="divided" />
      ) : !series.length ? (
        <EmptyState icon="calendar-sync" title="No series yet" message="Group recurring events into a series on the dashboard, then manage its events here." />
      ) : (
        <View style={styles.group}>
          {series.map((s, i) => {
            const status = eventStatusMeta(s.status);
            return (
              <ListRow
                key={s.id}
                leading={<IconTile icon="calendar-sync" size={34} />}
                title={s.name}
                subtitle={`${s.cadence} · ${s.eventCount} ${pluralize(s.eventCount, "event", "events")}`}
                trailing={<Pill label={status.label} tone={status.tone} variant="outline" />}
                onPress={() => router.push({ pathname: "/control/ops/series/[id]", params: { id: s.id } })}
                divider={i < series.length - 1}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
});
