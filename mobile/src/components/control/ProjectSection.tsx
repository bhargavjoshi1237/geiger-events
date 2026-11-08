import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { controlApi } from "@/lib/control_api";
import { whenLabel } from "@/lib/control_meta";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEvent, ControlProject } from "@/types/portal";

type Props = {
  project: ControlProject;
  onOpenEvent: (event: ControlEvent) => void;
};

export function ProjectSection({ project, onOpenEvent }: Props) {
  const [events, setEvents] = useState<ControlEvent[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await controlApi<{ events: ControlEvent[] }>(`/api/control/projects/${project.id}/events`);
    if (res.ok) {
      setEvents(res.data.events);
      setFailed(null);
    } else {
      setFailed(res.error);
    }
  }, [project.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount, load is async
    if (project.can.events) void load();
  }, [project.can.events, load]);

  const header = (
    <SectionTitle action={<Pill label={project.role?.name ?? "No role yet"} tone="neutral" variant="outline" />}>
      {project.name}
    </SectionTitle>
  );

  if (!project.role || !project.can.events) {
    return (
      <View style={styles.section}>
        {header}
        <Card tone="subtle">
          <Text style={styles.note}>
            {project.role
              ? "Your role here doesn't include events."
              : "You don't have a role in this project yet. Ask a project admin to add you."}
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {header}
      {failed ? (
        <Card tone="subtle">
          <View style={styles.failed}>
            <Text style={styles.note}>{failed}</Text>
            <Button title="Try again" size="sm" variant="secondary" onPress={() => void load()} />
          </View>
        </Card>
      ) : events === null ? (
        <SkeletonList rows={2} variant="divided" />
      ) : !events.length ? (
        <Card tone="subtle">
          <Text style={styles.note}>No events in this project yet.</Text>
        </Card>
      ) : (
        <View style={styles.group}>
          {events.map((event, i) => (
            <ListRow
              key={event.id}
              leading={<IconTile icon="calendar" size={34} tone={event.when === "today" ? "success" : "neutral"} />}
              title={event.name}
              subtitle={[whenLabel(event), event.venue].filter(Boolean).join(" · ")}
              onPress={() => onOpenEvent(event)}
              divider={i < events.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  note: {
    ...type.body,
    color: colors.textSecondary,
  },
  failed: {
    gap: spacing.md,
    alignItems: "flex-start",
  },
});
