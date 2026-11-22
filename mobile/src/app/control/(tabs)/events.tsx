import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EventRow } from "@/components/control/EventRow";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
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

function inTab(event: ControlEvent, tab: Tab): boolean {
  if (tab === "drafts") return event.status === "Draft";
  if (tab === "past") return event.when === "past" && event.status !== "Draft";
  return event.when !== "past" && event.status !== "Draft";
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
  const inCurrentTab = useMemo(() => events.filter((e) => inTab(e, tab)), [events, tab]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inCurrentTab;
    return inCurrentTab.filter((e) => `${e.name} ${e.venue ?? ""} ${e.city ?? ""}`.toLowerCase().includes(q));
  }, [inCurrentTab, query]);

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
        {searching ? (
          <View style={styles.search}>
            <Input
              leftIcon="search"
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, venue or city…"
              autoCapitalize="none"
              autoFocus
            />
          </View>
        ) : null}
        <View style={styles.segment}>
          <Segmented options={TABS} value={tab} onChange={(next) => setTab(next as Tab)} />
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
          <View style={styles.group}>
            {filtered.map((event, i) => (
              <EventRow
                key={event.id}
                event={event}
                onPress={() => router.push({ pathname: "/control/event/[id]", params: { id: event.id } })}
                divider={i < filtered.length - 1}
              />
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
  search: {
    marginBottom: spacing.md,
  },
  segment: {
    marginBottom: spacing.lg + 4,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  note: {
    ...type.body,
    color: colors.textSecondary,
  },
});
