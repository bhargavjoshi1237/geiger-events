import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EventPicker } from "@/components/control/guests/EventPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { WaitlistPage } from "@/types/control_guests";

// Quick picks up to the whole line, so nobody types a number on the door.
function countOptions(waiting: number) {
  const picks = [1, 5, 10, 25].filter((n) => n < waiting);
  return [...picks, waiting].map((n) => ({ value: String(n), label: n === waiting && waiting > 1 ? `All ${n}` : String(n) }));
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
      body = (
        <View style={styles.stack}>
          {list.data.canPromote ? (
            <View style={styles.card}>
              <Text style={styles.label}>Confirm the next people in line</Text>
              <FilterChips options={countOptions(waitlist.length)} value={String(next)} onChange={(v) => setCount(Number(v))} />
              <Button title={`Confirm ${next}`} onPress={() => setConfirming(true)} fullWidth />
              <Text style={styles.meta}>They move to Confirmed. Guests aren&apos;t emailed from here.</Text>
            </View>
          ) : null}
          <View>
            <SectionTitle variant="kicker">{`${waitlist.length} waiting`}</SectionTitle>
            <View style={styles.group}>
              {waitlist.map((w, i) => (
                <ListRow
                  key={w.id}
                  leading={<Text style={styles.position}>{w.position ?? i + 1}</Text>}
                  title={w.name || w.email || "Guest"}
                  subtitle={[w.email, w.partySize > 1 ? `party of ${w.partySize}` : "", w.createdAt ? `joined ${fmtTimeAgo(w.createdAt)}` : ""].filter(Boolean).join(" · ")}
                  divider={i < waitlist.length - 1}
                />
              ))}
            </View>
          </View>
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
        <View style={styles.stack}>
          <Text style={styles.meta}>The first {next} in line become Confirmed, as long as the event has room.</Text>
          <View style={styles.actions}>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirming(false)} />
            <Button title="Confirm" onPress={() => void promote()} loading={busy} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  picker: {
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  label: {
    ...type.labelStrong,
    color: colors.foreground,
  },
  meta: {
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
  position: {
    ...type.mono,
    minWidth: 28,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
