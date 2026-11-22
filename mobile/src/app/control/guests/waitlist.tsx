import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EventPicker } from "@/components/control/guests/EventPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { WaitlistEntry, WaitlistPage } from "@/types/control_guests";

const stagger = (i: number) => Math.min(i, 8) * 50;

// Quick picks up to the whole line, so nobody types a number on the door.
function countOptions(waiting: number) {
  const picks = [1, 5, 10, 25].filter((n) => n < waiting);
  return [...picks, waiting].map((n) => ({ value: String(n), label: n === waiting && waiting > 1 ? `All ${n}` : String(n) }));
}

// Whoever has waited longest, read off the earliest join time.
function longestWait(entries: WaitlistEntry[]): string {
  const times = entries.map((w) => (w.createdAt ? Date.parse(w.createdAt) : NaN)).filter(Number.isFinite);
  return times.length ? fmtTimeAgo(new Date(Math.min(...times)).toISOString()) : "—";
}

export default function WaitlistScreen() {
  const { project } = useControl();
  const toast = useToast();
  const [eventId, setEventId] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = useControlQuery<WaitlistPage>(eventId ? `/api/control/guests/events/${eventId}/waitlist` : null);
  const waitlist = list.data?.waitlist ?? [];
  const next = Math.min(count, waitlist.length || 1);

  const promote = async () => {
    setBusy(true);
    const res = await controlApi<WaitlistPage>(`/api/control/guests/events/${eventId}/waitlist`, { method: "POST", body: { count: next } });
    setBusy(false);
    setConfirming(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    const promoted = res.data.promoted ?? 0;
    toast.success(promoted ? `Confirmed ${promoted} ${pluralize(promoted, "person", "people")} from the waitlist.` : "Nobody could be confirmed — the event may be full.");
    setCount(1);
    list.setData(res.data);
  };

  let body: React.ReactNode = null;
  if (eventId) {
    if (list.error && !list.data) {
      body = <EmptyState icon="circle-alert" title="Couldn't load the waitlist" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
    } else if (!list.data) {
      body = <SkeletonList rows={5} variant="divided" />;
    } else if (!waitlist.length) {
      body = <EmptyState icon="list-checks" title="Nobody's waiting" message="When this event fills up, people who sign up join the waitlist here." />;
    } else {
      const canPromote = list.data.canPromote;
      const heads = waitlist.reduce((sum, w) => sum + Math.max(1, w.partySize), 0);
      const groups = waitlist.filter((w) => w.partySize > 1).length;
      let step = 0;
      body = (
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Readout
              lead={{ label: "Waiting", value: String(waitlist.length), hint: pluralize(waitlist.length, "registration", "registrations") }}
              items={[
                { label: "Heads", value: String(heads), hint: "Guests included" },
                { label: "Groups", value: String(groups), hint: "Party of 2+" },
                { label: "Longest wait", value: longestWait(waitlist) },
              ]}
            />
          </Animated.View>

          {canPromote ? (
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title="Confirm from the waitlist" footer="They move to Confirmed as long as the event has room. Guests aren't emailed from here.">
                <View style={styles.panel}>
                  <FilterChips options={countOptions(waitlist.length)} value={String(next)} onChange={(v) => setCount(Number(v))} />
                  <View style={styles.meterBlock}>
                    <View style={styles.meterHead}>
                      <Text style={styles.meterLabel}>Next in line</Text>
                      <Text style={styles.meterValue}>
                        {next}
                        <Text style={styles.meterOf}>{` / ${waitlist.length}`}</Text>
                      </Text>
                    </View>
                    <TickMeter value={next} max={waitlist.length} ticks={40} height={14} label={`Confirming ${next} of ${waitlist.length} waiting`} />
                  </View>
                  <Button title={`Confirm ${next} ${pluralize(next, "person", "people")}`} icon="user-check" onPress={() => setConfirming(true)} fullWidth />
                </View>
              </ListGroup>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="In line" action={<CountBadge value={waitlist.length} />} footer="Oldest place first, the order confirming works through.">
              {waitlist.map((w, i) => {
                // Rows the Confirm button would move are tinted, so the pick reads straight off the list.
                const picked = canPromote && i < next;
                return (
                  <ListRow
                    key={w.id}
                    leading={
                      <View style={[styles.place, picked && styles.placePicked]}>
                        <Text style={[styles.placeText, picked && styles.placeTextPicked]}>{w.position ?? i + 1}</Text>
                      </View>
                    }
                    title={w.name || w.email || "Guest"}
                    subtitle={[w.name ? w.email : "", w.createdAt ? `joined ${fmtTimeAgo(w.createdAt)}` : ""].filter(Boolean).join(" · ") || undefined}
                    trailing={w.partySize > 1 ? <CountBadge value={`+${w.partySize - 1}`} /> : undefined}
                    divider={i < waitlist.length - 1}
                  />
                );
              })}
            </ListGroup>
          </Animated.View>
        </View>
      );
    }
  }

  return (
    <Screen scroll header={<ScreenHeader title="Waitlist" />}>
      {project ? (
        <View style={styles.picker}>
          <EventPicker projectId={project.id} value={eventId} onChange={(e) => setEventId(e.id)} />
        </View>
      ) : null}
      {body}
      <Sheet visible={confirming} onClose={() => setConfirming(false)} title={`Confirm ${next} ${pluralize(next, "person", "people")}?`}>
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>The first {next} in line become Confirmed, as long as the event has room.</Text>
          <View style={styles.actions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirming(false)} />
            <Button title={`Confirm ${next}`} onPress={() => void promote()} loading={busy} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  picker: {
    marginBottom: spacing.xl,
  },
  stack: {
    gap: spacing.xl,
  },
  panel: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  meterBlock: {
    gap: spacing.sm,
  },
  meterHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  meterLabel: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  meterValue: {
    ...type.figureSmall,
    color: colors.foreground,
  },
  meterOf: {
    color: colors.textTertiary,
  },
  place: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceActive,
  },
  placePicked: {
    borderColor: `${colors.success}59`,
    backgroundColor: `${colors.success}14`,
  },
  placeText: {
    ...type.mono,
    color: colors.mutedForeground,
  },
  placeTextPicked: {
    color: colors.success,
  },
  sheetBody: {
    gap: spacing.lg,
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
