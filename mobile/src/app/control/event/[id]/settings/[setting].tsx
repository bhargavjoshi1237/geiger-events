import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SettingsForm, type SettingValues } from "@/components/control/SettingsForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing } from "@/theme/tokens";
import type { ControlSetting } from "@/types/portal";

export default function EventSettingScreen() {
  const { id, setting: settingId } = useLocalSearchParams<{ id: string; setting: string }>();
  const insets = useSafeAreaInsets();
  const { project } = useControl();
  const list = useControlQuery<{ settings: ControlSetting[]; canEdit: boolean }>(`/api/control/events/${id}/settings`, { refetchOnFocus: false });
  const setting = list.data?.settings.find((s) => s.id === settingId) ?? null;
  const path = `/api/control/events/${id}/settings/${settingId}`;
  const query = useControlQuery<{ values: SettingValues }>(setting ? path : null, { refetchOnFocus: false });

  if (setting && query.data && list.data) {
    return (
      <SettingsForm
        key={JSON.stringify(query.data.values)}
        setting={setting}
        values={query.data.values}
        path={path}
        projectId={project?.id ?? ""}
        canEdit={list.data.canEdit}
        onSaved={(values) => query.setData({ values })}
      />
    );
  }

  const failure = (list.error && !list.data ? list.error : null) ?? (query.error && !query.data ? query.error : null);
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title={setting?.title ?? "Event settings"} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {failure ? (
          <EmptyState icon="circle-alert" title="Couldn't load these settings" message={failure} actionLabel="Try again" onAction={() => void (list.data ? query.reload() : list.reload())} />
        ) : list.data && !setting ? (
          <EmptyState icon="shield" title="Not available" message="This section isn't available in the app." />
        ) : (
          <SkeletonList rows={5} variant="card" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
