import { useRouter } from "expo-router";
import React from "react";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { eventStatusMeta } from "@/lib/control_meta";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import type { OpsSeries } from "@/types/control_ops";

export default function SeriesScreen() {
  const router = useRouter();
  const { project } = useControl();
  const list = useControlQuery<{ series: OpsSeries[] }>(project ? `/api/control/ops/projects/${project.id}/series` : null);
  const series = list.data?.series ?? [];

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load series" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!series.length) {
    body = <EmptyState icon="calendar-sync" title="No series yet" message="Group recurring events into a series on the dashboard, then manage its events here." />;
  } else {
    body = (
      <ListGroup title={`${series.length} ${pluralize(series.length, "series", "series")}`} footer="Series are created on the dashboard; add and remove their events here.">
        {series.map((s, i) => {
          const status = eventStatusMeta(s.status);
          return (
            <ListRow
              key={s.id}
              leading={<IconTile icon="calendar-sync" size={36} />}
              title={s.name}
              subtitle={[s.cadence, `${s.eventCount} ${pluralize(s.eventCount, "event", "events")}`, s.visibility].filter(Boolean).join(" · ")}
              trailing={<Pill label={status.label} tone={status.tone} variant="outline" />}
              onPress={() => router.push({ pathname: "/control/ops/series/[id]", params: { id: s.id } })}
              divider={i < series.length - 1}
            />
          );
        })}
      </ListGroup>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Event series" />}>
      <Animated.View entering={FadeInDown.springify()}>{body}</Animated.View>
    </Screen>
  );
}
