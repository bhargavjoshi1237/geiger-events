import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing } from "@/theme/tokens";
import type { OpsVenue } from "@/types/control_ops";

const VENUE_STATUS: Record<OpsVenue["status"], StatusMeta> = {
  Active: { label: "Active", tone: "success" },
  Inactive: { label: "Inactive", tone: "neutral" },
  Archived: { label: "Archived", tone: "neutral" },
};

function capacityLine(v: OpsVenue): string {
  const parts = [];
  if (v.seatedCapacity) parts.push(`${v.seatedCapacity.toLocaleString("en-US")} seated`);
  if (v.standingCapacity) parts.push(`${v.standingCapacity.toLocaleString("en-US")} standing`);
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

  return (
    <Screen scroll header={<ScreenHeader title="Venues" />}>
      <View style={styles.search}>
        <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search venues or cities…" autoCapitalize="none" />
      </View>
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load venues" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={5} variant="divided" />
      ) : !venues.length ? (
        term ? (
          <EmptyState icon="search" title="No venues match" message="Try another name or city." actionLabel="Clear search" onAction={() => setQuery("")} />
        ) : (
          <EmptyState icon="map-pin" title="No venues yet" message="Add venues to your venue book on the dashboard; edit their details here." />
        )
      ) : (
        <View style={styles.group}>
          {venues.map((v, i) => (
            <ListRow
              key={v.id}
              leading={<IconTile icon="map-pin" size={34} />}
              title={v.name}
              subtitle={[v.city, v.type, capacityLine(v)].filter(Boolean).join(" · ")}
              trailing={<Pill label={VENUE_STATUS[v.status]?.label ?? v.status} tone={VENUE_STATUS[v.status]?.tone ?? "neutral"} variant="outline" />}
              onPress={() => router.push({ pathname: "/control/ops/venues/[id]", params: { id: v.id } })}
              divider={i < venues.length - 1}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
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
