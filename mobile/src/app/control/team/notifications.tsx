import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Group } from "@/components/control/team/Group";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, selectionFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { TeamNotifications } from "@/types/control_team";

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

  return (
    <Screen scroll header={<ScreenHeader title="Notifications" />}>
      {settings.error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't load notifications" message={settings.error} actionLabel="Try again" onAction={() => void settings.reload()} />
      ) : !data ? (
        <SkeletonList rows={6} variant="divided" />
      ) : (
        <View>
          {locked ? <Text style={styles.note}>Your role can see these settings but not change them.</Text> : null}
          <Group>
            <ListRow
              title="Send transactional emails"
              subtitle="Off, this project sends no automated mail at all."
              trailing={<Switch value={data.enabled} onValueChange={(on) => void save({ enabled: on })} label="Send transactional emails" disabled={locked || busy} />}
              divider={false}
            />
          </Group>
          {data.groups.map((group) => (
            <View key={group.key}>
              <SectionTitle variant="kicker">{group.label}</SectionTitle>
              <Group>
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
                          onValueChange={(on) => void save({ types: { [item.key]: on } })}
                          label={item.label}
                          disabled={locked || busy || !data.enabled}
                        />
                      </View>
                    }
                    divider={i < group.items.length - 1}
                  />
                ))}
              </Group>
            </View>
          ))}
          <Text style={styles.note}>Push notifications, their delivery log and the scheduler stay on the dashboard.</Text>
        </View>
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
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
