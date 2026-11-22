import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { BOOKING_FILTERS, BOOKING_STATUS } from "@/components/control/sourcing/meta";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing } from "@/theme/tokens";
import type { BookingStats, VenueBooking } from "@/types/control_sourcing";

export default function BookingsScreen() {
  const router = useRouter();
  const { project } = useControl();
  const [filter, setFilter] = useState("upcoming");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  // The server filters, so typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const path = project
    ? `/api/control/sourcing/projects/${project.id}/bookings?filter=${encodeURIComponent(filter)}${term ? `&q=${encodeURIComponent(term)}` : ""}`
    : null;
  const list = useControlQuery<{ bookings: VenueBooking[]; stats: BookingStats }>(path);
  const bookings = list.data?.bookings ?? [];
  const stats = list.data?.stats;
  const filtered = filter !== "upcoming" || Boolean(term);

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in More first." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load bookings" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!bookings.length) {
    body = filtered ? (
      <EmptyState
        icon="search"
        title="Nothing matches"
        message="Try another search or filter."
        actionLabel="Show upcoming"
        onAction={() => {
          setQuery("");
          setFilter("upcoming");
        }}
      />
    ) : (
      <EmptyState
        icon="calendar-check"
        title="Nothing booked yet"
        message="Book or hold one of your venue spaces; the price comes from its published rates."
        actionLabel="Book a space"
        onAction={() => router.push("/control/sourcing/bookings/new")}
      />
    );
  } else {
    body = (
      <View style={styles.group}>
        {bookings.map((b, i) => {
          const meta = BOOKING_STATUS[b.displayStatus];
          return (
            <ListRow
              key={b.id}
              leading={<IconTile icon="calendar-check" size={34} tone={b.displayStatus === "Confirmed" ? "success" : "neutral"} />}
              title={b.title || b.spaceName}
              subtitle={[b.when, [b.spaceName, b.venueName].filter(Boolean).join(", "), b.totalLabel].filter(Boolean).join(" · ")}
              trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
              onPress={() => router.push({ pathname: "/control/sourcing/bookings/[id]", params: { id: b.id } })}
              divider={i < bookings.length - 1}
            />
          );
        })}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Instant Book"
          right={project ? <IconButton icon="plus" label="Book a space" variant="solid" onPress={() => router.push("/control/sourcing/bookings/new")} /> : undefined}
        />
      }
    >
      {stats ? (
        <View style={styles.stats}>
          <StatTile label="Upcoming" value={String(stats.upcoming)} hint="Confirmed" />
          <StatTile label="Active holds" value={String(stats.holds)} hint={stats.holdsExpiringSoon ? `${stats.holdsExpiringSoon} expire in 24 h` : "Provisional"} />
          <StatTile label="Booked value" value={stats.bookedValue} hint={stats.otherCurrencies ? `+${stats.otherCurrencies} currencies` : `${stats.hoursThisMonth} h this month`} />
        </View>
      ) : null}
      {project ? (
        <View style={styles.controls}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search reference, space, contact…" autoCapitalize="none" />
          <FilterChips options={BOOKING_FILTERS} value={filter} onChange={setFilter} />
        </View>
      ) : null}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  controls: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
});
