import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EventPicker } from "@/components/control/guests/EventPicker";
import { TallyRow } from "@/components/control/guests/TallyRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { DietaryReport } from "@/types/control_guests";

const stagger = (i: number) => Math.min(i, 8) * 50;

type NeedsGuest = DietaryReport["guests"][number];

// The catering and venue-ops handoff for one event, the same figures as the dashboard's report.
export default function DietaryScreen() {
  const { project } = useControl();
  const [eventId, setEventId] = useState<string | null>(null);
  const report = useControlQuery<DietaryReport>(eventId ? `/api/control/guests/events/${eventId}/dietary` : null);
  const data = report.data;

  let body: React.ReactNode = null;
  if (eventId) {
    if (report.error && !data) {
      body = <EmptyState icon="circle-alert" title="Couldn't load the report" message={report.error} actionLabel="Try again" onAction={() => void report.reload()} />;
    } else if (!data) {
      body = <SkeletonList rows={4} variant="card" />;
    } else if (!data.totals.withNeeds && !data.questions.length) {
      body = <EmptyState icon="heart" title="No needs recorded" message="Dietary and access needs collected at registration show up here." />;
    } else {
      const { totals } = data;
      let step = 0;
      body = (
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Readout
              lead={{ label: "Guests with needs", value: String(totals.withNeeds), hint: `${totals.heads} ${pluralize(totals.heads, "head", "heads")} incl. party` }}
              items={[
                { label: "Dietary", value: String(totals.dietary), hint: "For catering" },
                { label: "Access", value: String(totals.accessibility), hint: "For venue ops" },
              ]}
            />
          </Animated.View>

          {data.tags.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title="Dietary needs" footer={`Share of the ${totals.dietary} ${pluralize(totals.dietary, "guest", "guests")} with a dietary need. A guest can match more than one.`}>
                {data.tags.map((t, i) => (
                  <TallyRow key={t.tag} label={t.tag} count={t.count} of={totals.dietary} divider={i < data.tags.length - 1} />
                ))}
              </ListGroup>
            </Animated.View>
          ) : null}

          {data.questions.map((q) => (
            <Animated.View key={q.question} entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title={q.question} footer={`${q.total} ${pluralize(q.total, "answer", "answers")}`}>
                {q.counts.map((c, i) => (
                  <TallyRow key={c.label} label={c.label} count={c.count} of={q.total} divider={i < q.counts.length - 1} />
                ))}
              </ListGroup>
            </Animated.View>
          ))}

          {data.guests.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title="Guests with needs" action={<CountBadge value={data.guests.length} />}>
                {data.guests.map((g, i) => (
                  <NeedsRow key={g.id} guest={g} divider={i < data.guests.length - 1} />
                ))}
              </ListGroup>
            </Animated.View>
          ) : null}
        </View>
      );
    }
  }

  return (
    <Screen scroll header={<ScreenHeader title="Dietary & Accessibility" />}>
      {project ? (
        <View style={styles.picker}>
          <EventPicker projectId={project.id} value={eventId} onChange={(e) => setEventId(e.id)} />
        </View>
      ) : null}
      {body}
    </Screen>
  );
}

// One guest's needs in full, labelled by who acts on them, since catering and venue ops read different lines.
function NeedsRow({ guest, divider }: { guest: NeedsGuest; divider: boolean }) {
  const name = guest.name || guest.email;
  return (
    <View style={[styles.row, divider && styles.divided]}>
      <Avatar name={guest.name} email={guest.email} size={36} />
      <View style={styles.rowStack}>
        <View style={styles.rowTitle}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {guest.partySize > 1 ? <CountBadge value={`+${guest.partySize - 1}`} /> : null}
        </View>
        {guest.dietary ? <Need label="Dietary" text={guest.dietary} /> : null}
        {guest.accessibility ? <Need label="Access" text={guest.accessibility} /> : null}
      </View>
    </View>
  );
}

function Need({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.need}>
      <Text style={styles.needLabel}>{label}</Text>
      <Text style={styles.needText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    marginBottom: spacing.xl,
  },
  stack: {
    gap: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs + 2,
  },
  rowTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 22,
  },
  name: {
    ...type.labelStrong,
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
    color: colors.foreground,
  },
  need: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  needLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 18,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
    width: 52,
  },
  needText: {
    ...type.body,
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
    color: colors.mutedForeground,
  },
});
