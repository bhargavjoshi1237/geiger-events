import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { controlApi } from "@/lib/control_api";
import { CAPABILITY_META, whenLabel } from "@/lib/control_meta";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlCapability, ControlEventDetail } from "@/types/portal";

const ACCESS_ORDER: ControlCapability[] = ["checkIn", "guests", "orders", "analytics", "operations"];

export default function ControlEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<ControlEventDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await controlApi<ControlEventDetail>(`/api/control/events/${id}`);
    if (res.ok) {
      setDetail(res.data);
      setFailed(null);
    } else {
      setFailed(res.error);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount, load is async
    void load();
  }, [load]);

  const access = detail ? ACCESS_ORDER.filter((key) => detail.can[key]) : [];

  return (
    <Screen scroll header={<ScreenHeader title="Event" />}>
      {failed && !detail ? (
        <EmptyState icon="circle-alert" title="Couldn't open this event" message={failed} actionLabel="Try again" onAction={() => void load()} />
      ) : !detail ? (
        <SkeletonList rows={3} variant="card" />
      ) : (
        <View style={styles.stack}>
          <Card>
            <Text style={styles.name}>{detail.event.name}</Text>
            <Text style={styles.meta}>
              {[whenLabel(detail.event), detail.event.venue, detail.event.city].filter(Boolean).join(" · ")}
            </Text>
            <View style={styles.stats}>
              <Stat label="Sold" value={String(detail.event.sold)} />
              <Stat label="Capacity" value={detail.event.capacity ? String(detail.event.capacity) : "—"} />
              <Stat label="Status" value={detail.event.status} />
            </View>
          </Card>

          <View>
            <SectionTitle>Your access</SectionTitle>
            {access.length ? (
              <View style={styles.group}>
                {access.map((key, i) => (
                  <ListRow
                    key={key}
                    leading={<IconTile icon={CAPABILITY_META[key].icon} size={34} />}
                    title={CAPABILITY_META[key].label}
                    subtitle={CAPABILITY_META[key].detail}
                    divider={i < access.length - 1}
                  />
                ))}
              </View>
            ) : (
              <Card tone="subtle">
                <Text style={styles.meta}>Your role can see this event but has no tools here yet.</Text>
              </Card>
            )}
          </View>

          <Button
            title="Open in dashboard"
            icon="external-link"
            variant="secondary"
            onPress={() => void Linking.openURL(`${SUITE_ORIGIN}/events/project/${detail.projectId}`)}
            fullWidth
          />
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  meta: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
  },
  statValue: {
    ...type.bodyStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    ...type.caption,
    color: colors.textSecondary,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
});
