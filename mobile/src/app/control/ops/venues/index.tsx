import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { VENUE_ICON, venueStatus } from "@/components/control/ops/venue_meta";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { pluralize } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsVenue } from "@/types/control_ops";

function capacityLine(v: OpsVenue): string {
  const parts = [];
  if (v.seatedCapacity) parts.push(`${v.seatedCapacity.toLocaleString("en-US")} seated`);
  if (v.standingCapacity) parts.push(`${v.standingCapacity.toLocaleString("en-US")} standing`);
  if (v.spaces) parts.push(`${v.spaces} ${pluralize(v.spaces, "space", "spaces")}`);
  return parts.join(" · ");
}

export default function VenuesScreen() {
  const router = useRouter();
  const { project } = useControl();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  // Server-side search, so typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const list = useControlQuery<{ venues: OpsVenue[] }>(
    project ? `/api/control/ops/projects/${project.id}/venues${term ? `?q=${encodeURIComponent(term)}` : ""}` : null,
  );
  const venues = list.data?.venues ?? [];

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load venues" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!venues.length) {
    body = term ? (
      <EmptyState icon="search" title="No venues match" message="Try another name or city." actionLabel="Clear search" onAction={() => setQuery("")} />
    ) : (
      <EmptyState icon="map-pin" title="No venues yet" message="Add venues to your venue book on the dashboard; edit their details here." />
    );
  } else {
    body = (
      <ListGroup title={term ? `${venues.length} ${pluralize(venues.length, "match", "matches")}` : `${venues.length} ${pluralize(venues.length, "venue", "venues")}`}>
        {venues.map((v, i) => (
          <VenueRow key={v.id} venue={v} onPress={() => router.push({ pathname: "/control/ops/venues/[id]", params: { id: v.id } })} divider={i < venues.length - 1} />
        ))}
      </ListGroup>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Venues" />}>
      <View style={styles.search}>
        <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search venues or cities…" autoCapitalize="none" />
      </View>
      <Animated.View entering={FadeInDown.springify()}>{body}</Animated.View>
    </Screen>
  );
}

// A venue with its photo when it has one, where it is, and its capacities in mono.
function VenueRow({ venue: v, onPress, divider }: { venue: OpsVenue; onPress: () => void; divider: boolean }) {
  const status = venueStatus(v.status);
  const place = [v.city, v.country].filter(Boolean).join(", ");
  const capacity = capacityLine(v);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${v.name}, ${status.label}${place ? `, ${place}` : ""}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      {v.coverUrl ? (
        <Image source={{ uri: v.coverUrl }} contentFit="cover" transition={150} style={styles.thumb} />
      ) : (
        <IconTile icon={VENUE_ICON[v.type] ?? "map-pin"} size={48} />
      )}
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, v.status === "Archived" && styles.nameMuted]} numberOfLines={1}>
            {v.name}
          </Text>
          <Pill label={status.label} tone={status.tone} variant="outline" />
        </View>
        <Text style={styles.place} numberOfLines={1}>
          {[v.type, place].filter(Boolean).join(" · ")}
        </Text>
        {capacity ? (
          <Text style={styles.capacity} numberOfLines={1}>
            {capacity}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: spacing.lg,
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
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceActive,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
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
  place: {
    ...type.caption,
    color: colors.textSecondary,
  },
  capacity: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
