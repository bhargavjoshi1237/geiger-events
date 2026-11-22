import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CoverWash } from "@/components/control/CoverWash";
import { DateStub } from "@/components/control/DateStub";
import { EventRow } from "@/components/control/EventRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { eventDateLine, eventDayNumeral, eventStatusMeta } from "@/lib/control_meta";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { OpsSeriesDetail } from "@/types/control_ops";
import type { ControlEvent } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 8) * 50;
const isAhead = (e: ControlEvent) => e.when !== "past";

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
  const shown = candidates.slice(0, 30);
  const next = data?.events.find((e) => e.when === "today" || e.when === "upcoming") ?? null;
  const openEvent = (event: ControlEvent) => router.push({ pathname: "/control/event/[id]", params: { id: event.id } });

  let body: React.ReactNode;
  if (detail.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't open this series" message={detail.error} actionLabel="Try again" onAction={() => void detail.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={4} variant="card" />;
  } else {
    const { series, events } = data;
    const status = eventStatusMeta(series.status);
    const ahead = events.filter(isAhead);
    const past = events.filter((e) => !isAhead(e));
    const sold = events.reduce((n, e) => n + e.sold, 0);
    const capacity = events.reduce((n, e) => n + e.capacity, 0);
    let step = 0;

    const occurrences = (title: string, list: ControlEvent[], at: number) => (
      <Animated.View key={title} entering={FadeInDown.delay(stagger(at)).springify()}>
        <ListGroup title={`${title} · ${list.length}`}>
          {list.map((event, i) => (
            <View key={event.id} style={[styles.memberRow, i < list.length - 1 && styles.divided]}>
              <View style={styles.memberMain}>
                <EventRow event={event} onPress={() => openEvent(event)} divider={false} />
              </View>
              {canEdit ? <IconButton icon="x" label={`Remove ${event.name} from the series`} variant="plain" size={36} iconSize={16} onPress={() => setRemoving(event)} /> : null}
            </View>
          ))}
        </ListGroup>
      </Animated.View>
    );

    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
          <View style={styles.heroTop}>
            {next ? <DateStub date={next.date} today={next.when === "today"} size="lg" /> : <IconTile icon="calendar-sync" size={56} />}
            <View style={styles.heroText}>
              <Text style={[styles.when, next?.when === "today" && styles.whenToday]} numberOfLines={1}>
                {next ? `Next · ${eventDateLine(next)}` : "Nothing coming up"}
              </Text>
              <Text style={styles.cadence} numberOfLines={1}>
                {[series.cadence, series.visibility].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{series.name}</Text>
          <View style={styles.chips}>
            <Pill label={status.label} tone={status.tone} />
            {series.followPage ? <Pill label="Follow page" tone="neutral" variant="outline" dot={false} /> : null}
          </View>
          {series.description ? (
            <Text style={styles.description} numberOfLines={4}>
              {series.description}
            </Text>
          ) : null}
        </Animated.View>

        {events.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Readout
              lead={{ label: "Sold across the series", value: sold.toLocaleString("en-US"), hint: capacity > 0 ? `of ${capacity.toLocaleString("en-US")}` : undefined }}
              items={[
                { label: "Events", value: String(events.length) },
                { label: "Coming up", value: String(ahead.length) },
                { label: "Past", value: String(past.length) },
              ]}
            >
              {capacity > 0 ? <TickMeter value={sold} max={capacity} ticks={44} height={16} label={`${sold} of ${capacity} sold across the series`} /> : null}
            </Readout>
          </Animated.View>
        ) : null}

        {!events.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <SectionTitle variant="kicker">Events in this series</SectionTitle>
            <EmptyState
              icon="calendar"
              title="No events yet"
              message="Add events from this project to the series."
              actionLabel={canEdit ? "Add an event" : undefined}
              onAction={canEdit ? () => setAdding(true) : undefined}
            />
          </Animated.View>
        ) : (
          <>
            {ahead.length ? occurrences("Coming up", ahead, step++) : null}
            {past.length ? occurrences("Past", past, step++) : null}
          </>
        )}
      </View>
    );
  }

  return (
    <Screen
      scroll
      backdrop={next ? <CoverWash uri={next.coverUrl} numeral={eventDayNumeral(next.date)} /> : undefined}
      header={
        <ScreenHeader
          title="Series"
          right={canEdit && data ? <IconButton icon="plus" label="Add an event" variant="solid" onPress={() => setAdding(true)} /> : undefined}
        />
      }
    >
      {body}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add an event">
        <View style={styles.sheetBody}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search events…" autoCapitalize="none" />
          {!candidates.length ? (
            <Text style={styles.caption}>No events outside a series match. An event can only belong to one series.</Text>
          ) : (
            <ListGroup footer={candidates.length > shown.length ? `Showing ${shown.length} of ${candidates.length}. Search to narrow it down.` : undefined}>
              {shown.map((event, i) => (
                <EventRow key={event.id} event={event} onPress={() => void setMember(event, true)} divider={i < shown.length - 1} />
              ))}
            </ListGroup>
          )}
          {busy ? <Text style={styles.caption}>Adding…</Text> : null}
        </View>
      </Sheet>

      <Sheet visible={Boolean(removing)} onClose={() => setRemoving(null)} title="Remove from series?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>{`${removing?.name ?? "This event"} stays as a standalone event; nothing else changes.`}</Text>
          <View style={styles.actions}>
            <Button title="Keep it" variant="ghost" onPress={() => setRemoving(null)} />
            <Button title="Remove from series" variant="destructive" loading={Boolean(busy)} onPress={() => removing && void setMember(removing, false)} />
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
  hero: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  when: {
    ...type.mono,
    color: colors.foreground,
  },
  whenToday: {
    color: colors.success,
  },
  cadence: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  name: {
    ...type.display,
    color: colors.foreground,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  description: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  memberMain: {
    flex: 1,
    minWidth: 0,
  },
  caption: {
    ...type.caption,
    color: colors.textSecondary,
  },
  sheetBody: {
    gap: spacing.md,
  },
  sheetText: {
    ...type.body,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
