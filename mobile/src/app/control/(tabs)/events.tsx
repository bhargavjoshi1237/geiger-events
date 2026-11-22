import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EventRow } from "@/components/control/EventRow";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Card } from "@/components/ui/Card";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { ControlEvent } from "@/types/portal";

type Tab = "upcoming" | "drafts" | "past";

const TABS: { value: Tab; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "drafts", label: "Drafts" },
  { value: "past", label: "Past" },
];

const EMPTY: Record<Tab, { title: string; message: string }> = {
  upcoming: { title: "No upcoming events", message: "Scheduled and on-sale events show up here." },
  drafts: { title: "No drafts", message: "New events start as drafts until you publish them." },
  past: { title: "No past events", message: "Finished events show up here." },
};

type Section = { key: string; title: string; footer?: string; events: ControlEvent[] };

const stagger = (i: number) => Math.min(i, 8) * 50;

function inTab(event: ControlEvent, tab: Tab): boolean {
  if (tab === "drafts") return event.status === "Draft";
  if (tab === "past") return event.when === "past" && event.status !== "Draft";
  return event.when !== "past" && event.status !== "Draft";
}

// "October 2026" from the event's own calendar date, never via a UTC midnight.
function monthOf(date: string | null): { key: string; label: string } {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? "");
  if (!m) return { key: "none", label: "Earlier" };
  const label = new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { key: `${m[1]}-${m[2]}`, label };
}

// Splits a tab into titled groups: upcoming by how soon, past by month, drafts as one group.
function sectionsFor(tab: Tab, events: ControlEvent[]): Section[] {
  if (tab === "drafts") {
    return [{ key: "drafts", title: "Not published", footer: "Only your team can see drafts until you publish them.", events }];
  }
  if (tab === "upcoming") {
    return [
      { key: "today", title: "On today", events: events.filter((e) => e.when === "today") },
      { key: "upcoming", title: "Coming up", events: events.filter((e) => e.when === "upcoming") },
      { key: "unscheduled", title: "No date yet", events: events.filter((e) => e.when === "unscheduled") },
    ].filter((s) => s.events.length);
  }
  const months = new Map<string, Section>();
  for (const event of events) {
    const month = monthOf(event.date);
    const section = months.get(month.key);
    if (section) section.events.push(event);
    else months.set(month.key, { key: month.key, title: month.label, events: [event] });
  }
  return [...months.values()];
}

export default function ControlEventsScreen() {
  const router = useRouter();
  const { project } = useControl();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const canEvents = Boolean(project?.role && project.can.events);
  const list = useControlQuery<{ events: ControlEvent[] }>(
    canEvents && project ? `/api/control/projects/${project.id}/events` : null,
  );

  const events = useMemo(() => list.data?.events ?? [], [list.data]);
  // Search narrows every tab at once, so the counts on the switcher show where the matches are.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => `${e.name} ${e.venue ?? ""} ${e.city ?? ""}`.toLowerCase().includes(q));
  }, [events, query]);
  const filtered = useMemo(() => matches.filter((e) => inTab(e, tab)), [matches, tab]);
  const sections = useMemo(() => sectionsFor(tab, filtered), [tab, filtered]);
  const tabOptions = useMemo(
    () =>
      TABS.map((t) => {
        const count = matches.filter((e) => inTab(e, t.value)).length;
        return { value: t.value, label: count ? `${t.label} · ${count}` : t.label };
      }),
    [matches],
  );

  const newEvent = () => router.push("/control/event/new");

  let body: React.ReactNode;
  if (!project || !canEvents) {
    body = (
      <Card tone="subtle">
        <Text style={styles.note}>
          {project?.role ? "Your role here doesn't include events." : "You don't have a role in this project yet."}
        </Text>
      </Card>
    );
  } else if (list.error && !list.data) {
    body = (
      <EmptyState
        icon="circle-alert"
        title="Couldn't load events"
        message={list.error}
        actionLabel="Try again"
        onAction={() => void list.reload()}
      />
    );
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="card" />;
  } else if (!events.length) {
    body = (
      <EmptyState
        icon="calendar"
        title="No events yet"
        message="Create your first event, then add tickets and publish it."
        actionLabel={project.can.create ? "New event" : undefined}
        onAction={project.can.create ? newEvent : undefined}
      />
    );
  } else {
    body = (
      <>
        <View style={styles.toolbar}>
          {searching ? (
            <Input
              leftIcon="search"
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, venue or city…"
              autoCapitalize="none"
              autoFocus
            />
          ) : null}
          <Segmented options={tabOptions} value={tab} onChange={(next) => setTab(next as Tab)} />
        </View>
        {!filtered.length ? (
          query.trim() ? (
            <EmptyState
              icon="search"
              title="No matching events"
              message="Try a different name, venue or city."
              actionLabel="Clear search"
              onAction={() => setQuery("")}
            />
          ) : (
            <EmptyState
              icon="calendar"
              title={EMPTY[tab].title}
              message={EMPTY[tab].message}
              actionLabel={tab === "drafts" && project.can.create ? "New event" : undefined}
              onAction={tab === "drafts" && project.can.create ? newEvent : undefined}
            />
          )
        ) : (
          <View style={styles.stack}>
            {sections.map((section, si) => (
              <Animated.View key={`${tab}:${section.key}`} entering={FadeInDown.delay(stagger(si)).springify()}>
                <ListGroup
                  title={section.title}
                  action={<CountBadge value={section.events.length} tone={section.key === "today" ? "success" : "neutral"} />}
                  footer={section.footer}
                >
                  {section.events.map((event, i) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      onPress={() => router.push({ pathname: "/control/event/[id]", params: { id: event.id } })}
                      divider={i < section.events.length - 1}
                    />
                  ))}
                </ListGroup>
              </Animated.View>
            ))}
          </View>
        )}
      </>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle
        title="Events"
        eyebrow={project?.name}
        right={
          <View style={styles.actions}>
            {events.length ? (
              <IconButton
                icon={searching ? "x" : "search"}
                label={searching ? "Close search" : "Search events"}
                variant="plain"
                onPress={() => {
                  setSearching((s) => !s);
                  setQuery("");
                }}
              />
            ) : null}
            {canEvents && project?.can.create ? <IconButton icon="plus" label="New event" variant="solid" onPress={newEvent} /> : null}
          </View>
        }
      />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  toolbar: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  stack: {
    gap: spacing.xl,
  },
  note: {
    ...type.body,
    color: colors.textSecondary,
  },
});
