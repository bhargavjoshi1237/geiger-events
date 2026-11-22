import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Notice } from "@/components/control/team/Notice";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
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

const stagger = (i: number) => Math.min(i, 8) * 50;

// Groups keep the server's order: categories appear where their first add-on does.
function byCategory(addons: TeamAddon[]): { category: string; addons: TeamAddon[] }[] {
  const groups = new Map<string, TeamAddon[]>();
  for (const addon of addons) {
    const key = addon.category || "Other";
    groups.set(key, [...(groups.get(key) ?? []), addon]);
  }
  return [...groups].map(([category, list]) => ({ category, addons: list }));
}

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

  let body: React.ReactNode;
  if (list.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load add-ons" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={3} variant="card" />;
  } else if (!data.addons.length) {
    body = <EmptyState icon="layers" title="No add-ons installed" message="Add-ons available to this project will appear here." />;
  } else {
    const groups = byCategory(data.addons);
    let step = 1;
    body = groups.map((group) => {
      const on = group.addons.filter((a) => a.enabled).length;
      return (
        <Animated.View key={group.category} entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title={group.category} action={<CountBadge value={`${on} on`} tone={on ? "success" : "neutral"} />}>
            {group.addons.map((addon, i) => (
              <AddonRow
                key={addon.id}
                addon={addon}
                disabled={!data.canManage || busy !== null}
                onToggle={(next) => void toggle(addon, next)}
                divider={i < group.addons.length - 1}
              />
            ))}
          </ListGroup>
        </Animated.View>
      );
    });
  }

  return (
    <Screen scroll header={<ScreenHeader title="Add-ons" />}>
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          {data && !data.canManage ? (
            <Notice text="Your role can see add-ons but not turn them on or off." />
          ) : (
            <Text style={styles.lede}>Turning one on adds its screens to the dashboard for everyone on this project.</Text>
          )}
        </Animated.View>
        {body}
      </View>
    </Screen>
  );
}

// An add-on reads as on or off at a glance: the tile lights green, and its features list underneath.
function AddonRow({ addon, disabled, onToggle, divider }: { addon: TeamAddon; disabled: boolean; onToggle: (on: boolean) => void; divider: boolean }) {
  return (
    <View style={[styles.addon, divider && styles.divided]}>
      <View style={styles.head}>
        <IconTile icon={addon.enabled ? "circle-check" : "layers"} size={36} tone={addon.enabled ? "success" : "neutral"} />
        <View style={styles.titleStack}>
          <Text style={styles.title} numberOfLines={1}>
            {addon.name}
          </Text>
          <Text style={[styles.state, addon.enabled && styles.stateOn]}>
            {addon.enabled ? "On" : "Off"}
            {addon.version ? <Text style={styles.version}>{`  ·  v${addon.version}`}</Text> : null}
          </Text>
        </View>
        <Switch value={addon.enabled} onValueChange={onToggle} label={addon.name} disabled={disabled} />
      </View>
      {addon.description ? <Text style={styles.body}>{addon.description}</Text> : null}
      {addon.features.length ? (
        <View style={styles.features}>
          {addon.features.map((feature) => (
            <View key={feature} style={styles.feature}>
              <Icon name="check" size={13} color={addon.enabled ? colors.success : colors.textTertiary} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  addon: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  titleStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  state: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
  stateOn: {
    color: colors.success,
  },
  version: {
    color: colors.textTertiary,
  },
  body: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  features: {
    gap: spacing.xs + 2,
  },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  featureText: {
    ...type.caption,
    flex: 1,
    color: colors.mutedForeground,
  },
});
