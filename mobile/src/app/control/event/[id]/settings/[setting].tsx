import { useLocalSearchParams } from "expo-router";
import React from "react";

import { FormScreen } from "@/components/control/forms/FormScreen";
import { FormSkeleton } from "@/components/control/forms/FormSkeleton";
import { SettingsForm, type SettingValues } from "@/components/control/SettingsForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import type { ControlSetting } from "@/types/portal";

export default function EventSettingScreen() {
  const { id, setting: settingId } = useLocalSearchParams<{ id: string; setting: string }>();
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
    <FormScreen title={setting?.title ?? "Event settings"}>
      {failure ? (
        <EmptyState icon="circle-alert" title="Couldn't load these settings" message={failure} actionLabel="Try again" onAction={() => void (list.data ? query.reload() : list.reload())} />
      ) : list.data && !setting ? (
        <EmptyState icon="shield" title="Not available" message="This section isn't available in the app." />
      ) : (
        <FormSkeleton />
      )}
    </FormScreen>
  );
}
