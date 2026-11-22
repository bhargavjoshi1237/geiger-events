import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { iconOf } from "@/lib/control_records";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlSetting } from "@/types/portal";

// The event editor's sections that work on a phone; page design and seating stay on the dashboard.
export default function EventSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useControlQuery<{ settings: ControlSetting[]; canEdit: boolean }>(`/api/control/events/${id}/settings`, { refetchOnFocus: false });
  const settings = query.data?.settings ?? [];

  return (
    <Screen scroll header={<ScreenHeader title="Event settings" />}>
      <Text style={styles.lede}>The event editor&apos;s sections. Page design, seating and floor plans stay on the dashboard.</Text>
      {query.error && !query.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load event settings" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      ) : !query.data ? (
        <SkeletonList rows={6} variant="divided" />
      ) : !settings.length ? (
        <EmptyState icon="settings" title="Nothing here yet" message="This event's editor sections will appear here." />
      ) : (
        <View style={styles.group}>
          {settings.map((s, i) => (
            <ListRow
              key={s.id}
              leading={<IconTile icon={iconOf(s.icon, "settings")} size={34} />}
              title={s.title}
              subtitle={s.description}
              onPress={() => router.push({ pathname: "/control/event/[id]/settings/[setting]", params: { id, setting: s.id } })}
              divider={i < settings.length - 1}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
});
