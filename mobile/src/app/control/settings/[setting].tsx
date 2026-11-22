import { useLocalSearchParams } from "expo-router";
import React from "react";

import { FormScreen } from "@/components/control/forms/FormScreen";
import { FormSkeleton } from "@/components/control/forms/FormSkeleton";
import { SettingsForm, type SettingValues } from "@/components/control/SettingsForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { useControlCatalog } from "@/lib/use_control_catalog";
import { useControlQuery } from "@/lib/use_control_query";

export default function SettingScreen() {
  const { setting: settingId } = useLocalSearchParams<{ setting: string }>();
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

  let body: React.ReactNode = <FormSkeleton />;
  if (catalog.error && !catalog.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load settings" message={catalog.error} actionLabel="Try again" onAction={() => void catalog.reload()} />;
  } else if (catalog.data && !setting) {
    body = <EmptyState icon="shield" title="Not available" message="Your role can't change these settings in this project." />;
  } else if (query.error && !query.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load settings" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />;
  }

  return <FormScreen title={setting?.title ?? "Settings"}>{body}</FormScreen>;
}
