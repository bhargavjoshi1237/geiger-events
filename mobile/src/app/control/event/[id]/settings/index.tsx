import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormHeader, MetaText } from "@/components/control/forms/FormHeader";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { iconOf } from "@/lib/control_records";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { spacing } from "@/theme/tokens";
import type { ControlSetting } from "@/types/portal";

type Group = { key: string; title: string; ids?: string[] };

// The editor's sections grouped the way an organiser thinks about them; list and single-value sections are page content.
const GROUPS: Group[] = [
  { key: "content", title: "Page content" },
  { key: "registration", title: "RSVP & registration", ids: ["event.rsvp", "event.regSettings", "event.dietaryRequests", "event.dietaryInquiry"] },
  {
    key: "tickets",
    title: "Tickets & pricing",
    ids: ["event.ticketRules", "event.ticketSelection", "event.earlybird", "event.discountSettings", "event.groupPurchase", "event.donation", "event.seating", "event.slotBooking"],
  },
  { key: "checkout", title: "Checkout", ids: ["event.payments", "event.express", "event.purchaseDisclaimer"] },
  { key: "page", title: "Page & sharing", ids: ["event.ctas", "event.sectionTitles", "event.disclaimer", "event.access", "event.url", "event.seo", "event.calendar", "event.embed"] },
  { key: "venue", title: "Venue & time", ids: ["event.location", "event.map", "event.timezoneSettings", "event.hybrid", "event.recurring"] },
  { key: "door", title: "At the door", ids: ["event.checkin", "event.checkinDoorKiosk", "event.badge"] },
  { key: "partners", title: "Packages & sponsors", ids: ["event.packages", "event.packagesPage", "event.sponsorshipPage", "event.sponsorsDisplay", "event.expo"] },
];

const OTHER: Group = { key: "other", title: "More settings" };

function groupOf(setting: ControlSetting): Group {
  if (setting.shape === "list" || setting.shape === "value") return GROUPS[0];
  return GROUPS.find((g) => g.ids?.includes(setting.id)) ?? OTHER;
}

const stagger = (i: number) => Math.min(i, 8) * 50;

// The event editor's sections that work on a phone; page design and seating stay on the dashboard.
export default function EventSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useControlQuery<{ settings: ControlSetting[]; canEdit: boolean }>(`/api/control/events/${id}/settings`, { refetchOnFocus: false });
  const [search, setSearch] = useState("");
  const settings = useMemo(() => query.data?.settings ?? [], [query.data]);

  const grouped = useMemo(
    () =>
      [...GROUPS, OTHER]
        .map((group) => ({ group, items: settings.filter((s) => groupOf(s).key === group.key) }))
        .filter((g) => g.items.length),
    [settings],
  );
  const q = search.trim().toLowerCase();
  const hits = useMemo(
    () => (q ? settings.filter((s) => `${s.title} ${s.description ?? ""} ${groupOf(s).title}`.toLowerCase().includes(q)) : []),
    [settings, q],
  );

  const open = (s: ControlSetting) => router.push({ pathname: "/control/event/[id]/settings/[setting]", params: { id, setting: s.id } });
  const row = (s: ControlSetting, i: number, count: number, subtitle?: string) => (
    <ListRow
      key={s.id}
      leading={<IconTile icon={iconOf(s.icon, "settings")} size={36} />}
      title={s.title}
      subtitle={subtitle}
      onPress={() => open(s)}
      divider={i < count - 1}
    />
  );

  let body: React.ReactNode;
  if (query.error && !query.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load event settings" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />;
  } else if (!query.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!settings.length) {
    body = <EmptyState icon="settings" title="Nothing here yet" message="This event's editor sections will appear here." actionLabel="Check again" onAction={() => void query.reload()} />;
  } else if (q) {
    body = hits.length ? (
      <ListGroup title={`${hits.length} ${pluralize(hits.length, "match", "matches")}`}>{hits.map((s, i) => row(s, i, hits.length, groupOf(s).title))}</ListGroup>
    ) : (
      <EmptyState icon="search-x" title="Nothing called that" message="Try the section's name as it reads in the dashboard's event editor." actionLabel="Clear search" onAction={() => setSearch("")} />
    );
  } else {
    body = (
      <View style={styles.groups}>
        {grouped.map(({ group, items }, i) => (
          <Animated.View key={group.key} entering={FadeInDown.delay(stagger(i + 1)).springify()}>
            <ListGroup title={group.title}>{items.map((s, j) => row(s, j, items.length, s.description))}</ListGroup>
          </Animated.View>
        ))}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Event settings" />}>
      <Animated.View entering={FadeInDown.delay(stagger(0)).springify()} style={styles.head}>
        <FormHeader
          leading={<IconTile icon="sliders-horizontal" size={52} />}
          title="Event editor"
          description="Content, tickets, checkout and the rest of the editor. Page design, seating and floor plans stay on the dashboard."
          meta={
            query.data ? (
              <>
                {!query.data.canEdit ? <Pill label="View only" tone="neutral" variant="outline" dot={false} /> : null}
                <MetaText>{`${settings.length} ${pluralize(settings.length, "section", "sections")} · ${grouped.length} ${pluralize(grouped.length, "group", "groups")}`}</MetaText>
              </>
            ) : undefined
          }
        />
      </Animated.View>
      {settings.length ? (
        <View style={styles.search}>
          <Input leftIcon="search" value={search} onChangeText={setSearch} placeholder="Find a section…" autoCapitalize="none" autoCorrect={false} />
        </View>
      ) : null}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    marginBottom: spacing.xl,
  },
  search: {
    marginBottom: spacing.xl,
  },
  groups: {
    gap: spacing.xl,
  },
});
