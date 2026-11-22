import React, { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDateTime } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Lead } from "@/types/control_checkin_ops";

export default function LeadsScreen() {
  const { project } = useControl();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);

  // Server-side search, so typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const path = project ? `/api/control/checkin_ops/projects/${project.id}/leads${term ? `?q=${encodeURIComponent(term)}` : ""}` : null;
  const list = useControlQuery<{ leads: Lead[]; exhibitors: number }>(path);
  const leads = list.data?.leads ?? [];

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load leads" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!leads.length) {
    body = term ? (
      <EmptyState icon="search" title="No matching leads" message="Try another name or exhibitor." actionLabel="Clear search" onAction={() => setQuery("")} />
    ) : (
      <EmptyState icon="contact" title="No leads yet" message="When exhibitors scan attendee badges, the contacts they capture appear here." />
    );
  } else {
    body = (
      <View style={styles.group}>
        {leads.map((lead, i) => (
          <ListRow
            key={lead.id}
            title={lead.name || lead.email || "Unnamed lead"}
            subtitle={[lead.company, lead.exhibitor && `by ${lead.exhibitor}`, lead.eventName].filter(Boolean).join(" · ")}
            onPress={() => setSelected(lead)}
            divider={i < leads.length - 1}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Lead retrieval" />}>
      {list.data && !term ? (
        <View style={styles.tiles}>
          <StatTile label="Leads" value={leads.length.toLocaleString("en-US")} />
          <StatTile label="Exhibitors" value={String(list.data.exhibitors)} />
        </View>
      ) : null}
      <View style={styles.search}>
        <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search name or exhibitor…" autoCapitalize="none" />
      </View>
      {body}
      <Sheet visible={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || "Lead"}>
        {selected ? (
          <View style={styles.detail}>
            {[
              ["Company", [selected.title, selected.company].filter(Boolean).join(", ")],
              ["Captured by", selected.exhibitor],
              ["Event", selected.eventName],
              ["Captured", fmtDateTime(selected.capturedAt)],
              ["Notes", selected.notes],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            <View style={styles.group}>
              {selected.email ? (
                <ListRow title={selected.email} subtitle="Email" onPress={() => void Linking.openURL(`mailto:${selected.email}`)} divider={Boolean(selected.phone)} />
              ) : null}
              {selected.phone ? <ListRow title={selected.phone} subtitle="Phone" onPress={() => void Linking.openURL(`tel:${selected.phone}`)} divider={false} /> : null}
            </View>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
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
  detail: {
    gap: spacing.md,
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    ...type.micro,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  detailValue: {
    ...type.body,
    color: colors.foreground,
  },
});
