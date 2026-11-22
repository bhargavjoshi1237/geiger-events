import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Notice } from "@/components/control/team/Notice";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, selectionFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamNotifications } from "@/types/control_team";

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function NotificationsScreen() {
  const { project } = useControl();
  const toast = useToast();
  const path = project ? `/api/control/team/${project.id}/notifications` : null;
  const settings = useControlQuery<TeamNotifications>(path);
  const [busy, setBusy] = useState(false);
  const data = settings.data;
  const locked = !data?.canManage;

  // Each switch saves as it's flipped; the server merges it over the stored config.
  const save = async (body: { enabled?: boolean; types?: Record<string, boolean> }) => {
    if (!path || locked || busy) return;
    selectionFeedback();
    setBusy(true);
    const res = await controlApi<TeamNotifications>(path, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    settings.setData(res.data);
  };

  let body: React.ReactNode;
  if (settings.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load notifications" message={settings.error} actionLabel="Try again" onAction={() => void settings.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else {
    let step = 0;
    body = (
      <View style={styles.stack}>
        {locked ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Notice text="Your role can see these settings but not change them." />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Transactional email">
            <ListRow
              leading={<IconTile icon={data.enabled ? "mail-check" : "mail"} size={36} tone={data.enabled ? "success" : "neutral"} />}
              title="Send transactional emails"
              subtitle={data.enabled ? "On — the emails switched on below go out automatically." : "Off, this project sends no automated mail at all."}
              trailing={<Switch value={data.enabled} onValueChange={(on) => void save({ enabled: on })} label="Send transactional emails" disabled={locked || busy} />}
              divider={false}
            />
          </ListGroup>
        </Animated.View>

        {data.groups.map((group) => {
          const on = group.items.filter((item) => item.on).length;
          return (
            <Animated.View key={group.key} entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup
                title={group.label}
                action={<CountBadge value={`${on}/${group.items.length}`} tone={data.enabled && on ? "success" : "neutral"} />}
                footer={group.description || undefined}
              >
                {group.items.map((item, i) => (
                  <ListRow
                    key={item.key}
                    title={item.label}
                    subtitle={[item.audience, item.description].filter(Boolean).join(" · ")}
                    trailing={
                      <View style={styles.trailing}>
                        {item.live ? null : <Pill label="Planned" tone="neutral" variant="outline" dot={false} />}
                        <Switch
                          value={item.on}
                          onValueChange={(next) => void save({ types: { [item.key]: next } })}
                          label={item.label}
                          disabled={locked || busy || !data.enabled}
                        />
                      </View>
                    }
                    divider={i < group.items.length - 1}
                  />
                ))}
              </ListGroup>
            </Animated.View>
          );
        })}

        <Text style={styles.caption}>Push notifications, their delivery log and the scheduler stay on the dashboard.</Text>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Notifications" />}>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  caption: {
    ...type.caption,
    color: colors.textTertiary,
  },
});
