import React, { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtCompactTime, fmtDateTime } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { Lead } from "@/types/control_checkin_ops";

const distinct = (values: string[]) => new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)).size;

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
      <ListGroup title={term ? `${leads.length} ${leads.length === 1 ? "match" : "matches"}` : "Latest captures"}>
        {leads.map((lead, i) => (
          <ListRow
            key={lead.id}
            leading={<Avatar name={lead.name} email={lead.email} size={36} />}
            title={lead.name || lead.email || "Unnamed lead"}
            subtitle={[lead.company, lead.exhibitor && `by ${lead.exhibitor}`, lead.eventName].filter(Boolean).join(" · ")}
            trailing={lead.capturedAt ? <Text style={styles.time}>{fmtCompactTime(lead.capturedAt)}</Text> : undefined}
            onPress={() => setSelected(lead)}
            divider={i < leads.length - 1}
          />
        ))}
      </ListGroup>
    );
  }

  const facts = selected
    ? [
        { label: "Company", value: [selected.title, selected.company].filter(Boolean).join(", "), mono: false },
        { label: "Captured by", value: selected.exhibitor, mono: false },
        { label: "Event", value: selected.eventName, mono: false },
        { label: "Captured", value: fmtDateTime(selected.capturedAt), mono: true },
      ].filter((f) => f.value)
    : [];

  return (
    <Screen scroll header={<ScreenHeader title="Lead retrieval" />}>
      {list.data && !term && leads.length ? (
        <Animated.View entering={FadeInDown.springify()} style={styles.readout}>
          <Readout
            lead={{ label: "Leads captured", value: leads.length.toLocaleString("en-US") }}
            items={[
              { label: "Exhibitors", value: String(list.data.exhibitors) },
              { label: "Companies", value: String(distinct(leads.map((l) => l.company))) },
              { label: "Events", value: String(distinct(leads.map((l) => l.eventName))) },
            ]}
          />
        </Animated.View>
      ) : null}
      <View style={styles.search}>
        <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search name or exhibitor…" autoCapitalize="none" />
      </View>
      {body}
      <Sheet visible={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || "Lead"}>
        {selected ? (
          <View style={styles.detail}>
            {facts.length ? (
              <ListGroup>
                {facts.map((f, i) => (
                  <DetailRow key={f.label} label={f.label} value={f.value} mono={f.mono} divider={i < facts.length - 1} />
                ))}
              </ListGroup>
            ) : null}
            {selected.notes ? <Text style={styles.notes}>{selected.notes}</Text> : null}
            {selected.email || selected.phone ? (
              <ListGroup title="Get in touch">
                {selected.email ? (
                  <ListRow
                    leading={<IconTile icon="mail" size={36} />}
                    title={selected.email}
                    subtitle="Email"
                    onPress={() => void Linking.openURL(`mailto:${selected.email}`)}
                    divider={Boolean(selected.phone)}
                  />
                ) : null}
                {selected.phone ? (
                  <ListRow
                    leading={<IconTile icon="smartphone" size={36} />}
                    title={selected.phone}
                    subtitle="Phone"
                    onPress={() => void Linking.openURL(`tel:${selected.phone}`)}
                    divider={false}
                  />
                ) : null}
              </ListGroup>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  readout: {
    marginBottom: spacing.lg,
  },
  search: {
    marginBottom: spacing.xl,
  },
  time: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  detail: {
    gap: spacing.lg,
  },
  notes: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
