import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Input } from "@/components/ui/Input";
import { Meter } from "@/components/ui/Meter";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { CapacityPayload, CapacityRow } from "@/types/control_final";

const SORTS = [
  { value: "fill-desc", label: "Fullest" },
  { value: "fill-asc", label: "Emptiest" },
  { value: "remaining-desc", label: "Most left" },
  { value: "capacity-desc", label: "Largest" },
  { value: "name-asc", label: "A–Z" },
];

const COMPARE: Record<string, (a: CapacityRow, b: CapacityRow) => number> = {
  "fill-desc": (a, b) => b.fill - a.fill,
  "fill-asc": (a, b) => a.fill - b.fill,
  "remaining-desc": (a, b) => b.remaining - a.remaining,
  "capacity-desc": (a, b) => b.effective - a.effective,
  "name-asc": (a, b) => a.name.localeCompare(b.name),
};

// Live fill across every event: confirmed seats against capacity plus the overbook buffer, as on the dashboard.
export default function CapacityLimitsScreen() {
  const { project } = useControl();
  const query = useControlQuery<CapacityPayload>(project ? `/api/control/final/projects/${project.id}/capacity` : null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("fill-desc");
  const [editing, setEditing] = useState<CapacityRow | null>(null);
  const data = query.data;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(data?.events ?? [])].filter((r) => !q || r.name.toLowerCase().includes(q)).sort(COMPARE[sort]);
  }, [data, search, sort]);

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in More to see its events." />;
  } else if (query.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load capacity" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={5} variant="card" />;
  } else if (!data.events.length) {
    body = <EmptyState icon="gauge" title="No events yet" message="Create an event to start tracking its capacity and fill." />;
  } else if (!rows.length) {
    body = <EmptyState icon="search" title="No events match" message="Try a different search." actionLabel="Clear search" onAction={() => setSearch("")} />;
  } else {
    body = (
      <View style={styles.list}>
        {rows.map((row) => (
          <CapacityCard key={row.id} row={row} canEdit={data.canEdit} onPress={() => setEditing(row)} />
        ))}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Capacity Limits" />}>
      <Text style={styles.lede}>Confirmed registrations count against each cap; a buffer allows a little overbooking.</Text>
      {data ? (
        <View style={styles.stats}>
          <StatTile label="At capacity" value={String(data.stats.atCapacity)} />
          <StatTile label="Total seats" value={data.stats.totalSeats.toLocaleString("en-US")} />
          <StatTile label="Avg. fill" value={`${data.stats.averageFill}%`} />
        </View>
      ) : null}
      {data?.events.length ? (
        <View style={styles.controls}>
          <Input leftIcon="search" value={search} onChangeText={setSearch} placeholder="Search events…" autoCapitalize="none" />
          <FilterChips options={SORTS} value={sort} onChange={setSort} />
        </View>
      ) : null}
      {body}
      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title="Adjust capacity">
        {editing ? (
          <AdjustForm
            row={editing}
            onClose={() => setEditing(null)}
            onSaved={(capacity, buffer) => {
              const effective = capacity + buffer;
              query.setData((prev) =>
                prev
                  ? {
                      ...prev,
                      events: prev.events.map((e) =>
                        e.id === editing.id
                          ? {
                              ...e,
                              capacity,
                              buffer,
                              effective,
                              fill: effective ? Math.round((e.seats / effective) * 100) : 0,
                              remaining: Math.max(0, effective - e.seats),
                              full: effective > 0 && e.seats >= effective,
                            }
                          : e,
                      ),
                    }
                  : prev,
              );
              setEditing(null);
              void query.reload();
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

function CapacityCard({ row, canEdit, onPress }: { row: CapacityRow; canEdit: boolean; onPress: () => void }) {
  const meta = [row.date ? fmtDate(row.date) : "No date", row.buffer ? `+${row.buffer} buffer` : ""].filter(Boolean).join(" · ");
  const body = (
    <>
      <View style={styles.cardHead}>
        <View style={styles.cardText}>
          <Text style={styles.cardName} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={styles.cardMeta}>{meta}</Text>
        </View>
        <View style={styles.cardFigures}>
          <Text style={[styles.cardSeats, row.full && styles.full]}>
            {row.seats}
            <Text style={styles.cardOf}>{`/${row.effective || "∞"}`}</Text>
          </Text>
          {row.full ? <Pill label="Full" tone="danger" /> : <Text style={styles.cardMeta}>{row.effective ? `${row.fill}% full` : "No cap"}</Text>}
        </View>
      </View>
      {row.effective ? <Meter value={row.seats} max={row.effective} label={`${row.seats} of ${row.effective} seats taken`} /> : null}
    </>
  );
  if (!canEdit) return <View style={styles.card}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.seats} of ${row.effective || "unlimited"} seats. Adjust capacity`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

function AdjustForm({ row, onClose, onSaved }: { row: CapacityRow; onClose: () => void; onSaved: (capacity: number, buffer: number) => void }) {
  const toast = useToast();
  const [capacity, setCapacity] = useState(String(row.capacity));
  const [buffer, setBuffer] = useState(String(row.buffer));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const cap = Number(capacity.trim() || "0");
    const buf = Number(buffer.trim() || "0");
    if (!Number.isInteger(cap) || cap < 0 || !Number.isInteger(buf) || buf < 0) return toast.error("Use whole numbers, 0 or more.");
    setBusy(true);
    const res = await controlApi<{ saved: boolean }>(`/api/control/final/events/${row.id}/capacity`, { method: "PATCH", body: { capacity: cap, buffer: buf } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Capacity updated.");
    onSaved(cap, buf);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Text style={styles.cardName}>{row.name}</Text>
        <Field label="Capacity" hint="Total seats available. 0 means no cap.">
          <Input value={capacity} onChangeText={setCapacity} keyboardType="number-pad" selectTextOnFocus />
        </Field>
        <Field label="Overbook buffer" hint="Extra seats beyond capacity.">
          <Input value={buffer} onChangeText={setBuffer} keyboardType="number-pad" selectTextOnFocus />
        </Field>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Save" onPress={() => void save()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  controls: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardName: {
    ...type.label,
    fontSize: 15,
    color: colors.foreground,
  },
  cardMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  cardFigures: {
    alignItems: "flex-end",
    gap: 4,
  },
  cardSeats: {
    ...type.bodyStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  cardOf: {
    ...type.body,
    color: colors.textSecondary,
  },
  full: {
    color: colors.danger,
  },
  form: {
    gap: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
