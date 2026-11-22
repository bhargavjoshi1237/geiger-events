import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DateStub } from "@/components/control/DateStub";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
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

const stagger = (i: number) => Math.min(i, 8) * 50;
const num = (n: number) => n.toLocaleString("en-US");

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

  const capped = (data?.events ?? []).filter((r) => r.effective > 0);
  const taken = capped.reduce((sum, r) => sum + r.seats, 0);
  const seatsOf = capped.reduce((sum, r) => sum + r.effective, 0);

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
      <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
        <ListGroup
          title={`${rows.length} ${pluralize(rows.length, "event", "events")}`}
          footer={data.canEdit ? "Tap an event to change its cap or buffer." : "Your role can see capacity but not change it."}
        >
          {rows.map((row, i) => (
            <CapacityItem key={row.id} row={row} canEdit={data.canEdit} onPress={() => setEditing(row)} divider={i < rows.length - 1} />
          ))}
        </ListGroup>
      </Animated.View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Capacity Limits" />}>
      <View style={styles.stack}>
        <Text style={styles.lede}>Confirmed registrations count against each cap; a buffer allows a little overbooking.</Text>
        {data ? (
          <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
            <Readout
              lead={{ label: "Average fill", value: `${data.stats.averageFill}%`, hint: capped.length ? `across ${capped.length} capped ${pluralize(capped.length, "event", "events")}` : "no caps set" }}
              items={[
                { label: "At capacity", value: String(data.stats.atCapacity), tone: data.stats.atCapacity ? "warning" : "neutral" },
                { label: "Total seats", value: num(data.stats.totalSeats), hint: "Before buffers" },
                { label: "Taken", value: num(taken), hint: seatsOf ? `of ${num(seatsOf)}` : undefined },
              ]}
            >
              {capped.length ? <TickMeter value={data.stats.averageFill} max={100} ticks={44} height={16} label={`Average fill ${data.stats.averageFill}%`} /> : null}
            </Readout>
          </Animated.View>
        ) : null}
        {data?.events.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(1)).springify()} style={styles.controls}>
            <Input leftIcon="search" value={search} onChangeText={setSearch} placeholder="Search events…" autoCapitalize="none" />
            <FilterChips options={SORTS} value={sort} onChange={setSort} />
          </Animated.View>
        ) : null}
        {body}
      </View>
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

// One event's limit: date stub, seats taken against cap plus buffer on the tick scale, and the rest of its registrations.
function CapacityItem({ row, canEdit, onPress, divider }: { row: CapacityRow; canEdit: boolean; onPress: () => void; divider: boolean }) {
  const breakdown = [
    row.buffer ? `cap ${num(row.capacity)} + ${num(row.buffer)} buffer` : "",
    row.checkedIn ? `${num(row.checkedIn)} in` : "",
    row.pending ? `${num(row.pending)} pending` : "",
    row.waitlisted ? `${num(row.waitlisted)} waitlist` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <DateStub date={row.date} muted={!row.date} />
      <View style={styles.itemStack}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {row.name}
          </Text>
          {row.full ? <Pill label="Full" tone="warning" /> : null}
        </View>
        {row.effective ? (
          <View style={styles.meterRow}>
            <View style={styles.meter}>
              <TickMeter value={row.seats} max={row.effective} ticks={30} height={10} tone={row.full ? "warning" : "success"} label={`${row.seats} of ${row.effective} seats taken`} />
            </View>
            <Text style={styles.count}>
              {num(row.seats)}
              <Text style={styles.countOf}>{`/${num(row.effective)}`}</Text>
            </Text>
          </View>
        ) : (
          <Text style={styles.noCap}>{`${num(row.seats)} taken · no cap`}</Text>
        )}
        <View style={styles.facts}>
          {row.effective ? <Text style={[styles.fill, row.full && styles.fillFull]}>{`${row.fill}%`}</Text> : null}
          {row.effective ? <Text style={styles.fact}>{row.full ? "No seats left" : `${num(row.remaining)} left`}</Text> : null}
          {breakdown ? (
            <Text style={styles.fact} numberOfLines={1}>
              {breakdown}
            </Text>
          ) : null}
        </View>
      </View>
      {canEdit ? <Icon name="chevron-right" size={18} color={colors.textTertiary} /> : null}
    </>
  );

  if (!canEdit) return <View style={[styles.item, divider && styles.divided]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.seats} of ${row.effective || "unlimited"} seats. Adjust capacity`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.item, divider && styles.divided, pressed && styles.pressed]}
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
  const cap = Number(capacity.trim() || "0");
  const buf = Number(buffer.trim() || "0");
  const valid = Number.isInteger(cap) && cap >= 0 && Number.isInteger(buf) && buf >= 0;

  const save = async () => {
    if (!valid) return toast.error("Use whole numbers, 0 or more.");
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
        <View style={styles.sheetHead}>
          <DateStub date={row.date} muted={!row.date} />
          <View style={styles.sheetHeadText}>
            <Text style={styles.name} numberOfLines={2}>
              {row.name}
            </Text>
            <Text style={styles.fact}>{`${num(row.seats)} seats taken now`}</Text>
          </View>
        </View>
        <View style={styles.pair}>
          <View style={styles.half}>
            <Field label="Capacity" hint="0 means no cap.">
              <Input value={capacity} onChangeText={setCapacity} keyboardType="number-pad" selectTextOnFocus />
            </Field>
          </View>
          <View style={styles.half}>
            <Field label="Overbook buffer" hint="Extra seats beyond it.">
              <Input value={buffer} onChangeText={setBuffer} keyboardType="number-pad" selectTextOnFocus />
            </Field>
          </View>
        </View>
        {valid ? (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Sells up to</Text>
            <Text style={styles.previewValue}>{cap + buf > 0 ? num(cap + buf) : "No cap"}</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Save capacity" onPress={() => void save()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  lede: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: -spacing.sm,
  },
  controls: {
    gap: spacing.md,
  },
  item: {
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
  itemStack: {
    flex: 1,
    minWidth: 0,
    gap: 5,
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
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  meter: {
    flex: 1,
  },
  count: {
    ...type.monoSmall,
    color: colors.foreground,
  },
  countOf: {
    color: colors.textTertiary,
  },
  noCap: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  facts: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm + 2,
  },
  fill: {
    ...type.mono,
    color: colors.foreground,
  },
  fillFull: {
    color: colors.warning,
  },
  fact: {
    ...type.monoSmall,
    fontSize: 11,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.lg,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sheetHeadText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  pair: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  preview: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    paddingTop: spacing.md,
  },
  previewLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  previewValue: {
    ...type.figureSmall,
    color: colors.foreground,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
