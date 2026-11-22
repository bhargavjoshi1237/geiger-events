import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { EventPicker } from "@/components/control/guests/EventPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { DietaryReport } from "@/types/control_guests";

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
      body = (
        <View style={styles.stack}>
          <View style={styles.tiles}>
            <StatTile label="With needs" value={String(data.totals.withNeeds)} hint={`${data.totals.heads} heads`} />
            <StatTile label="Dietary" value={String(data.totals.dietary)} hint="For catering" />
            <StatTile label="Access" value={String(data.totals.accessibility)} hint="For venue ops" />
          </View>

          {data.tags.length ? (
            <View>
              <SectionTitle variant="kicker">Dietary</SectionTitle>
              <View style={styles.group}>
                {data.tags.map((t, i) => (
                  <ListRow key={t.tag} title={t.tag} trailing={<Text style={styles.count}>{t.count}</Text>} divider={i < data.tags.length - 1} />
                ))}
              </View>
            </View>
          ) : null}

          {data.questions.map((q) => (
            <View key={q.question}>
              <SectionTitle variant="kicker">{q.question}</SectionTitle>
              <View style={styles.group}>
                {q.counts.map((c, i) => (
                  <ListRow key={c.label} title={c.label} trailing={<Text style={styles.count}>{c.count}</Text>} divider={i < q.counts.length - 1} />
                ))}
              </View>
            </View>
          ))}

          {data.guests.length ? (
            <View>
              <SectionTitle variant="kicker">Guests</SectionTitle>
              <View style={styles.group}>
                {data.guests.map((g, i) => (
                  <ListRow
                    key={g.id}
                    title={g.partySize > 1 ? `${g.name || g.email} (+${g.partySize - 1})` : g.name || g.email}
                    subtitle={[g.dietary && `Dietary: ${g.dietary}`, g.accessibility && `Access: ${g.accessibility}`].filter(Boolean).join("\n")}
                    divider={i < data.guests.length - 1}
                  />
                ))}
              </View>
            </View>
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

const styles = StyleSheet.create({
  picker: {
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.xl,
  },
  tiles: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  count: {
    ...type.bodyStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
});
