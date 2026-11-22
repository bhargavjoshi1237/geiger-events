import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SettingsForm, type SettingValues } from "@/components/control/SettingsForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControlCatalog } from "@/lib/use_control_catalog";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, spacing } from "@/theme/tokens";

export default function SettingScreen() {
  const { setting: settingId } = useLocalSearchParams<{ setting: string }>();
  const insets = useSafeAreaInsets();
  const catalog = useControlCatalog();
  const setting = catalog.data?.sections.flatMap((s) => s.settings).find((s) => s.id === settingId) ?? null;
  const path = setting && catalog.projectId ? `/api/control/projects/${catalog.projectId}/settings/${setting.id}` : null;
  const query = useControlQuery<{ values: SettingValues }>(path, { refetchOnFocus: false });

  if (setting && query.data && path && catalog.projectId) {
    // Keyed by the saved values so a save re-seeds the form from what the server stored.
    return (
      <SettingsForm
        key={JSON.stringify(query.data.values)}
        setting={setting}
        values={query.data.values}
        path={path}
        projectId={catalog.projectId}
        onSaved={(values) => query.setData({ values })}
      />
    );
  }

  let body: React.ReactNode = <SkeletonList rows={5} variant="card" />;
  if (catalog.error && !catalog.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load settings" message={catalog.error} actionLabel="Try again" onAction={() => void catalog.reload()} />;
  } else if (catalog.data && !setting) {
    body = <EmptyState icon="shield" title="Not available" message="Your role can't change these settings in this project." />;
  } else if (query.error && !query.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load settings" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title={setting?.title ?? "Settings"} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}>{body}</ScrollView>
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
