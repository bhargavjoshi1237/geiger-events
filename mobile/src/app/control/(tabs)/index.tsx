import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EventRow } from "@/components/control/EventRow";
import { ProjectSwitcher } from "@/components/control/ProjectSwitcher";
import { TodayEventCard } from "@/components/control/TodayEventCard";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { moneyIn } from "@/lib/control_meta";
import { fmtDay, pluralize } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEvent, ControlSummary } from "@/types/portal";

const UPCOMING_LIMIT = 5;
const stagger = (i: number) => Math.min(i, 8) * 50;

type Attention = { key: string; icon: IconName; tone: "warning" | "info" | "neutral"; count: number; title: string; subtitle: string; onPress: () => void };

export default function ControlTodayScreen() {
  const router = useRouter();
  const { profile, profileError, refreshProfile, teamEmail, project } = useControl();
  const [switching, setSwitching] = useState(false);
  const canEvents = Boolean(project?.role && project.can.events);
  const summary = useControlQuery<ControlSummary>(canEvents && project ? `/api/control/projects/${project.id}/summary` : null);

  const multiple = (profile?.projects.length ?? 0) > 1;
  const openEvent = (event: ControlEvent) => router.push({ pathname: "/control/event/[id]", params: { id: event.id } });
  const checkIn = (event: ControlEvent) => router.push({ pathname: "/control/event/[id]/checkin", params: { id: event.id } });

  let body: React.ReactNode;
  if (profileError && !profile) {
    body = <EmptyState icon="circle-alert" title="Couldn't load your projects" message={profileError} actionLabel="Try again" onAction={() => void refreshProfile()} />;
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
          {project.role ? "Your role here doesn't include events." : "You don't have a role in this project yet. Ask a project admin to add you."}
        </Text>
      </Card>
    );
  } else if (summary.error && !summary.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load today" message={summary.error} actionLabel="Try again" onAction={() => void summary.reload()} />;
  } else if (!summary.data) {
    body = <SkeletonList rows={4} variant="card" />;
  } else {
    const data = summary.data;
    const attention = (
      [
        {
          key: "pending",
          icon: "user-check",
          tone: "warning",
          count: data.pendingApprovals,
          title: `${pluralize(data.pendingApprovals, "Registration", "Registrations")} to approve`,
          subtitle: "Decide them from each event's guest list",
          onPress: () => router.navigate("/control/events"),
        },
        {
          key: "unread",
          icon: "inbox",
          tone: "info",
          count: data.unreadThreads ?? 0,
          title: `Unread ${pluralize(data.unreadThreads ?? 0, "conversation", "conversations")}`,
          subtitle: "Buyers waiting on a reply",
          onPress: () => router.navigate("/control/inbox"),
        },
        {
          key: "drafts",
          icon: "square-pen",
          tone: "neutral",
          count: data.drafts,
          title: `${pluralize(data.drafts, "Draft", "Drafts")} not published`,
          subtitle: "Only your team can see them",
          onPress: () => router.navigate("/control/events"),
        },
      ] satisfies Attention[]
    ).filter((row) => row.count > 0);
    const upcoming = data.upcoming.slice(0, UPCOMING_LIMIT);
    let step = 0;

    body = (
      <View style={styles.stack}>
        {data.sales ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Readout
              lead={{ label: "Sales today", value: moneyIn(data.sales.today.revenue), hint: `${data.sales.today.sold} ${pluralize(data.sales.today.sold, "ticket", "tickets")}` }}
              items={[
                { label: "Orders today", value: String(data.sales.today.orders) },
                { label: "7 days", value: moneyIn(data.sales.week.revenue) },
                { label: "7-day tickets", value: String(data.sales.week.sold) },
              ]}
            />
          </Animated.View>
        ) : null}

        {attention.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Needs attention">
              {attention.map((row, i) => (
                <ListRow
                  key={row.key}
                  leading={<IconTile icon={row.icon} size={36} tone={row.tone} />}
                  title={row.title}
                  subtitle={row.subtitle}
                  trailing={<CountBadge value={row.count} tone={row.tone} />}
                  onPress={row.onPress}
                  divider={i < attention.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
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
            {data.today.length ? (
              <View>
                <SectionTitle variant="kicker">On today</SectionTitle>
                <View style={styles.cards}>
                  {data.today.map((event) => (
                    <Animated.View key={event.id} entering={FadeInDown.delay(stagger(step++)).springify()}>
                      <TodayEventCard event={event} onOpen={() => openEvent(event)} onCheckIn={project.can.checkIn ? () => checkIn(event) : undefined} />
                    </Animated.View>
                  ))}
                </View>
              </View>
            ) : (
              <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.quiet}>
                <Icon name="sun" size={18} color={colors.textTertiary} />
                <Text style={styles.quietText}>No events on today.</Text>
              </Animated.View>
            )}

            {upcoming.length ? (
              <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
                <ListGroup
                  title="Coming up"
                  action={
                    data.upcoming.length > UPCOMING_LIMIT ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="All events"
                        hitSlop={12}
                        onPress={() => {
                          tapFeedback();
                          router.navigate("/control/events");
                        }}
                        style={({ pressed }) => [styles.allLink, pressed && styles.pressed]}
                      >
                        <Text style={styles.allText}>All events</Text>
                        <Icon name="arrow-right" size={12} color={colors.foreground} />
                      </Pressable>
                    ) : undefined
                  }
                >
                  {upcoming.map((event, i) => (
                    <EventRow key={event.id} event={event} onPress={() => openEvent(event)} divider={i < upcoming.length - 1} />
                  ))}
                </ListGroup>
              </Animated.View>
            ) : null}
          </>
        )}

        {project.can.create ? (
          <Button title="New event" icon="calendar-plus" variant="secondary" fullWidth onPress={() => router.push("/control/event/new")} />
        ) : null}
      </View>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle
        eyebrow={fmtDay(new Date().toISOString())}
        title={project?.name ?? "Control"}
        right={multiple ? <IconButton icon="chevrons-up-down" label="Switch project" onPress={() => setSwitching(true)} /> : undefined}
      />
      {project ? <ProjectLine project={project} onPress={multiple ? () => setSwitching(true) : undefined} /> : null}
      {body}
      <ProjectSwitcher visible={switching} onClose={() => setSwitching(false)} />
    </Screen>
  );
}

// Who you are here: the organisation and your role, so a scoped staffer knows why some tools are missing.
function ProjectLine({ project, onPress }: { project: NonNullable<ReturnType<typeof useControl>["project"]>; onPress?: () => void }) {
  const text = [project.organizationName, project.role?.name ?? "No role yet"].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `${text}. Switch project` : text}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.projectLine, pressed && styles.pressed]}
    >
      <Icon name="shield-check" size={14} color={colors.success} />
      <Text style={styles.projectText} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  cards: {
    gap: spacing.md,
  },
  projectLine: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs + 2,
    marginTop: -spacing.sm,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.md - 2,
    maxWidth: "100%",
  },
  projectText: {
    ...type.captionStrong,
    color: colors.mutedForeground,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  quiet: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  quietText: {
    ...type.label,
    color: colors.textSecondary,
  },
  allLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  allText: {
    ...type.captionStrong,
    color: colors.foreground,
  },
  note: {
    ...type.body,
    color: colors.textSecondary,
  },
});
