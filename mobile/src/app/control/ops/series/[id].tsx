import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EventRow } from "@/components/control/EventRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { eventStatusMeta } from "@/lib/control_meta";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsSeriesDetail } from "@/types/control_ops";
import type { ControlEvent } from "@/types/portal";

export default function SeriesDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project } = useControl();
  const detail = useControlQuery<OpsSeriesDetail>(`/api/control/ops/series/${id}`);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ControlEvent | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const canEdit = Boolean(project?.can.edit);

  const setMember = async (event: ControlEvent, add: boolean) => {
    setBusy(event.id);
    const res = await controlApi<{ ok: boolean }>(`/api/control/ops/series/${id}/events`, { method: "POST", body: { eventId: event.id, add } });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(add ? `Added ${event.name}.` : `Removed ${event.name}.`);
    setAdding(false);
    setRemoving(null);
    void detail.reload();
  };

  const data = detail.data;
  const q = query.trim().toLowerCase();
  const candidates = (data?.candidates ?? []).filter((e) => !q || `${e.name} ${e.venue ?? ""}`.toLowerCase().includes(q));

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title={data?.series.name ?? "Series"}
          right={canEdit && data ? <IconButton icon="plus" label="Add an event" variant="solid" onPress={() => setAdding(true)} /> : undefined}
        />
      }
    >
      {detail.error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't open this series" message={detail.error} actionLabel="Try again" onAction={() => void detail.reload()} />
      ) : !data ? (
        <SkeletonList rows={4} variant="card" />
      ) : (
        <View style={styles.stack}>
          <Card>
            <View style={styles.head}>
              <Text style={styles.name}>{data.series.name}</Text>
              <Pill label={eventStatusMeta(data.series.status).label} tone={eventStatusMeta(data.series.status).tone} />
            </View>
            <Text style={styles.meta}>{[data.series.cadence, data.series.visibility].join(" · ")}</Text>
            {data.series.description ? <Text style={styles.body}>{data.series.description}</Text> : null}
          </Card>

          <View>
            <SectionTitle variant="kicker">Events in this series</SectionTitle>
            {!data.events.length ? (
              <EmptyState
                icon="calendar"
                title="No events yet"
                message="Add events from this project to the series."
                actionLabel={canEdit ? "Add an event" : undefined}
                onAction={canEdit ? () => setAdding(true) : undefined}
              />
            ) : (
              <View style={styles.group}>
                {data.events.map((event, i) => (
                  <View key={event.id} style={styles.memberRow}>
                    <View style={styles.memberMain}>
                      <EventRow
                        event={event}
                        onPress={() => router.push({ pathname: "/control/event/[id]", params: { id: event.id } })}
                        divider={i < data.events.length - 1}
                      />
                    </View>
                    {canEdit ? (
                      <IconButton icon="x" label={`Remove ${event.name} from the series`} variant="plain" size={36} iconSize={16} onPress={() => setRemoving(event)} />
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add an event">
        <View style={styles.sheetBody}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search events…" autoCapitalize="none" />
          {!candidates.length ? (
            <Text style={styles.caption}>No events outside a series match. An event can only belong to one series.</Text>
          ) : (
            <View style={styles.group}>
              {candidates.slice(0, 30).map((event, i) => (
                <EventRow key={event.id} event={event} onPress={() => void setMember(event, true)} divider={i < Math.min(candidates.length, 30) - 1} />
              ))}
            </View>
          )}
          {busy ? <Text style={styles.caption}>Adding…</Text> : null}
        </View>
      </Sheet>

      <Sheet visible={Boolean(removing)} onClose={() => setRemoving(null)} title="Remove from series?">
        <View style={styles.sheetBody}>
          <Text style={styles.body}>{`${removing?.name ?? "This event"} stays as a standalone event; nothing else changes.`}</Text>
          <View style={styles.actions}>
            <Button title="Keep it" variant="ghost" onPress={() => setRemoving(null)} />
            <Button title="Remove" variant="destructive" loading={Boolean(busy)} onPress={() => removing && void setMember(removing, false)} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: {
    ...type.title,
    flex: 1,
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  caption: {
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
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberMain: {
    flex: 1,
    minWidth: 0,
  },
  sheetBody: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
