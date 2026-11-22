import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DateStub } from "@/components/control/DateStub";
import { BOOKING_FILTERS, BOOKING_STATUS } from "@/components/control/sourcing/meta";
import { venueDate, whenTimes } from "@/components/control/sourcing/when";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDateTime, isToday, pluralize } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { BookingStats, VenueBooking } from "@/types/control_sourcing";

const stagger = (i: number) => Math.min(i, 8) * 50;

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
  const filterLabel = BOOKING_FILTERS.find((f) => f.value === filter)?.label ?? "Bookings";

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
      <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
        <ListGroup title={`${bookings.length} ${filter === "all" ? pluralize(bookings.length, "booking", "bookings") : filterLabel.toLowerCase()}`}>
          {bookings.map((b, i) => (
            <BookingRow
              key={b.id}
              booking={b}
              onPress={() => router.push({ pathname: "/control/sourcing/bookings/[id]", params: { id: b.id } })}
              divider={i < bookings.length - 1}
            />
          ))}
        </ListGroup>
      </Animated.View>
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
      <View style={styles.stack}>
        {stats ? (
          <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
            <Readout
              lead={{ label: "Booked value", value: stats.bookedValue, hint: stats.otherCurrencies ? `+${stats.otherCurrencies} more ${pluralize(stats.otherCurrencies, "currency", "currencies")}` : "confirmed" }}
              items={[
                { label: "Upcoming", value: String(stats.upcoming), hint: "Confirmed" },
                {
                  label: "Active holds",
                  value: String(stats.holds),
                  tone: stats.holdsExpiringSoon ? "warning" : "neutral",
                  hint: stats.holdsExpiringSoon ? `${stats.holdsExpiringSoon} expire in 24 h` : "Provisional",
                },
                { label: "This month", value: `${stats.hoursThisMonth} h`, hint: "Booked time" },
              ]}
            />
          </Animated.View>
        ) : null}
        {project ? (
          <Animated.View entering={FadeInDown.delay(stagger(1)).springify()} style={styles.controls}>
            <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search reference, space, contact…" autoCapitalize="none" />
            <FilterChips options={BOOKING_FILTERS} value={filter} onChange={setFilter} />
          </Animated.View>
        ) : null}
        {body}
      </View>
    </Screen>
  );
}

// A booking in the list: date stub on the venue's calendar, mono times and total, the space and its status.
function BookingRow({ booking: b, onPress, divider }: { booking: VenueBooking; onPress: () => void; divider: boolean }) {
  const meta = BOOKING_STATUS[b.displayStatus];
  const date = venueDate(b.startsAt, b.timezone);
  const done = b.displayStatus === "Completed" || b.displayStatus === "Cancelled" || b.displayStatus === "Hold expired";
  const place = [b.spaceName, b.venueName].filter(Boolean).join(", ");
  const name = b.title || b.spaceName || "Booking";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${b.when}, ${meta.label}, ${b.totalLabel}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      <DateStub date={date} today={!done && isToday(b.startsAt)} muted={done} />
      <View style={styles.rowStack}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, done && styles.nameMuted]} numberOfLines={1}>
            {name}
          </Text>
          <Pill label={meta.label} tone={meta.tone} variant="outline" />
        </View>
        <View style={styles.figures}>
          <Text style={styles.times} numberOfLines={1}>
            {whenTimes(b.when)}
          </Text>
          <Text style={[styles.total, done && styles.nameMuted]} numberOfLines={1}>
            {b.totalLabel}
          </Text>
        </View>
        {place ? (
          <Text style={styles.place} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
        {b.liveHold && b.holdExpiresAt ? (
          <View style={styles.expiry}>
            <Icon name="timer" size={12} color={colors.warning} />
            <Text style={styles.expiryText} numberOfLines={1}>{`Hold until ${fmtDateTime(b.holdExpiresAt)}`}</Text>
          </View>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  controls: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  nameMuted: {
    color: colors.mutedForeground,
  },
  figures: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  times: {
    ...type.monoSmall,
    flex: 1,
    color: colors.foreground,
  },
  total: {
    ...type.mono,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  place: {
    ...type.caption,
    color: colors.textSecondary,
  },
  expiry: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  expiryText: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.warning,
  },
});
