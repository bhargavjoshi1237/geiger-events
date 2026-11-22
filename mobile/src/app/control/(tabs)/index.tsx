import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EventRow } from "@/components/control/EventRow";
import { ProjectSwitcher } from "@/components/control/ProjectSwitcher";
import { StatTile } from "@/components/control/StatTile";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { moneyIn } from "@/lib/control_meta";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEvent, ControlSummary } from "@/types/portal";

export default function ControlTodayScreen() {
  const router = useRouter();
  const { profile, profileError, refreshProfile, teamEmail, project } = useControl();
  const [switching, setSwitching] = useState(false);
  const canEvents = Boolean(project?.role && project.can.events);
  const summary = useControlQuery<ControlSummary>(canEvents && project ? `/api/control/projects/${project.id}/summary` : null);

  const multiple = (profile?.projects.length ?? 0) > 1;
  const openEvent = (event: ControlEvent) => router.push({ pathname: "/control/event/[id]", params: { id: event.id } });

  const title = (
    <ScreenTitle
      eyebrow="Today"
      title={project?.name ?? "Control"}
      right={
        multiple ? (
          <Button title="Switch" size="sm" variant="secondary" icon="chevrons-up-down" onPress={() => setSwitching(true)} />
        ) : undefined
      }
    />
  );

  let body: React.ReactNode;
  if (profileError && !profile) {
    body = (
      <EmptyState
        icon="circle-alert"
        title="Couldn't load your projects"
        message={profileError}
        actionLabel="Try again"
        onAction={() => void refreshProfile()}
      />
    );
  } else if (!profile) {
    body = <SkeletonList rows={3} variant="card" />;
  } else if (!project) {
    body = (
      <EmptyState
        icon="briefcase"
        title="No event teams yet"
        message={`${teamEmail ?? "This account"} isn't on any project yet. Ask an organiser to invite you, then check again.`}
        actionLabel="Check again"
        onAction={() => void refreshProfile()}
      />
    );
  } else if (!canEvents) {
    body = (
      <Card tone="subtle">
        <Text style={styles.note}>
          {project.role
            ? "Your role here doesn't include events."
            : "You don't have a role in this project yet. Ask a project admin to add you."}
        </Text>
      </Card>
    );
  } else if (summary.error && !summary.data) {
    body = (
      <EmptyState
        icon="circle-alert"
        title="Couldn't load today"
        message={summary.error}
        actionLabel="Try again"
        onAction={() => void summary.reload()}
      />
    );
  } else if (!summary.data) {
    body = <SkeletonList rows={4} variant="card" />;
  } else {
    const data = summary.data;
    const attention = [
      data.pendingApprovals > 0 && {
        key: "pending",
        icon: "user-check" as const,
        title: `${data.pendingApprovals} ${pluralize(data.pendingApprovals, "registration", "registrations")} to approve`,
        subtitle: "Decide them from each event's guest list",
        onPress: () => router.navigate("/control/events"),
      },
      (data.unreadThreads ?? 0) > 0 && {
        key: "unread",
        icon: "inbox" as const,
        title: `${data.unreadThreads} unread ${pluralize(data.unreadThreads ?? 0, "conversation", "conversations")}`,
        subtitle: "Buyers waiting on a reply",
        onPress: () => router.navigate({ pathname: "/control/inbox" }),
      },
      data.drafts > 0 && {
        key: "drafts",
        icon: "square-pen" as const,
        title: `${data.drafts} ${pluralize(data.drafts, "draft", "drafts")} not published`,
        subtitle: "Only your team can see them",
        onPress: () => router.navigate("/control/events"),
      },
    ].filter((row): row is Exclude<typeof row, false> => Boolean(row));

    body = (
      <>
        {data.sales ? (
          <View style={styles.stats}>
            <StatTile label="Sales today" value={moneyIn(data.sales.today.revenue)} />
            <StatTile label="Tickets today" value={String(data.sales.today.sold)} />
            <StatTile label="Last 7 days" value={moneyIn(data.sales.week.revenue)} />
          </View>
        ) : null}

        {attention.length ? (
          <>
            <SectionTitle variant="kicker">Needs attention</SectionTitle>
            <View style={styles.group}>
              {attention.map((row, i) => (
                <ListRow
                  key={row.key}
                  leading={<IconTile icon={row.icon} size={34} />}
                  title={row.title}
                  subtitle={row.subtitle}
                  onPress={row.onPress}
                  divider={i < attention.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}

        {!data.today.length && !data.upcoming.length ? (
          <EmptyState
            icon="calendar"
            title="Nothing coming up"
            message="No events today or on the calendar yet."
            actionLabel={project.can.create ? "New event" : "See all events"}
            onAction={() => (project.can.create ? router.push("/control/event/new") : router.navigate("/control/events"))}
          />
        ) : (
          <>
            <SectionTitle variant="kicker">Today</SectionTitle>
            {data.today.length ? (
              <View style={styles.group}>
                {data.today.map((event, i) => (
                  <View key={event.id} style={i < data.today.length - 1 ? styles.divided : null}>
                    <EventRow event={event} onPress={() => openEvent(event)} divider={false} />
                    {project.can.checkIn ? (
                      <View style={styles.checkin}>
                        <Button
                          title="Check in"
                          size="sm"
                          variant="secondary"
                          icon="scan-line"
                          fullWidth
                          onPress={() => router.push({ pathname: "/control/event/[id]/checkin", params: { id: event.id } })}
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Card tone="subtle" style={styles.card}>
                <Text style={styles.note}>Nothing on today.</Text>
              </Card>
            )}

            <SectionTitle variant="kicker">Coming up</SectionTitle>
            {data.upcoming.length ? (
              <View style={styles.group}>
                {data.upcoming.map((event, i) => (
                  <EventRow key={event.id} event={event} onPress={() => openEvent(event)} divider={i < data.upcoming.length - 1} />
                ))}
              </View>
            ) : (
              <Card tone="subtle" style={styles.card}>
                <Text style={styles.note}>Nothing else scheduled yet.</Text>
              </Card>
            )}
          </>
        )}

        {project.can.create ? (
          <Button title="New event" icon="plus" variant="secondary" fullWidth onPress={() => router.push("/control/event/new")} />
        ) : null}
      </>
    );
  }

  return (
    <Screen scroll>
      {title}
      {body}
      <ProjectSwitcher visible={switching} onClose={() => setSwitching(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  checkin: {
    paddingBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.lg,
  },
  note: {
    ...type.body,
    color: colors.textSecondary,
  },
});
