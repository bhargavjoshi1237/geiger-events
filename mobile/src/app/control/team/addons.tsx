import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Group } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamAddon } from "@/types/control_team";

type AddonList = { addons: TeamAddon[]; canManage: boolean };

export default function AddonsScreen() {
  const { project } = useControl();
  const toast = useToast();
  const path = project ? `/api/control/team/${project.id}/addons` : null;
  const list = useControlQuery<AddonList>(path);
  const [busy, setBusy] = useState<string | null>(null);
  const data = list.data;

  const toggle = async (addon: TeamAddon, enabled: boolean) => {
    if (!path || busy) return;
    setBusy(addon.id);
    const res = await controlApi<{ addon: TeamAddon }>(path, { method: "PATCH", body: { addonId: addon.id, enabled } });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    list.setData((prev) => (prev ? { ...prev, addons: prev.addons.map((a) => (a.id === addon.id ? res.data.addon : a)) } : prev));
    toast.success(`${addon.name} ${enabled ? "turned on" : "turned off"}.`);
  };

  return (
    <Screen scroll header={<ScreenHeader title="Add-ons" />}>
      <Text style={styles.note}>
        {data && !data.canManage ? "Your role can see add-ons but not turn them on or off." : "Turning one on adds its screens to the dashboard for everyone on this project."}
      </Text>
      {list.error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't load add-ons" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !data ? (
        <SkeletonList rows={3} variant="card" />
      ) : !data.addons.length ? (
        <EmptyState icon="layers" title="No add-ons installed" message="Add-ons available to this project will appear here." />
      ) : (
        data.addons.map((addon) => (
          <Group key={addon.id}>
            <View style={styles.addon}>
              <View style={styles.head}>
                <View style={styles.titleStack}>
                  <Text style={styles.title}>{addon.name}</Text>
                  <Text style={styles.meta}>{[addon.category, addon.version && `v${addon.version}`].filter(Boolean).join(" · ")}</Text>
                </View>
                <Switch value={addon.enabled} onValueChange={(on) => void toggle(addon, on)} label={addon.name} disabled={!data.canManage || busy !== null} />
              </View>
              <Text style={styles.body}>{addon.description}</Text>
              {addon.features.map((feature) => (
                <Text key={feature} style={styles.feature}>{`•  ${feature}`}</Text>
              ))}
            </View>
          </Group>
        ))
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
  addon: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  titleStack: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
  },
  feature: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
