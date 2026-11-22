import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { LedgerRow } from "@/components/control/inventory/LedgerRow";
import { MOVEMENT_KINDS, MOVEMENT_META } from "@/components/control/inventory/meta";
import { MovementForm } from "@/components/control/inventory/MovementForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { ListGroup } from "@/components/ui/ListGroup";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtClock, fmtShortDay, isToday } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { InventoryItem, InventoryMovement } from "@/types/control_inventory";

const FILTERS = [{ value: "all", label: "All" }, ...MOVEMENT_KINDS.map((k) => ({ value: k.value, label: MOVEMENT_META[k.value].label }))];

const stagger = (i: number) => Math.min(i, 8) * 50;

function dayOf(iso: string | null): { key: string; title: string } {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { key: "undated", title: "Undated" };
  return { key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, title: isToday(iso) ? "Today" : fmtShortDay(iso) };
}

// The server sends newest first, so consecutive runs of the same day become one ledger page each.
function byDay(movements: InventoryMovement[]): { key: string; title: string; rows: InventoryMovement[] }[] {
  const days: { key: string; title: string; rows: InventoryMovement[] }[] = [];
  for (const m of movements) {
    const day = dayOf(m.createdAt);
    const last = days[days.length - 1];
    if (last && last.key === day.key) last.rows.push(m);
    else days.push({ ...day, rows: [m] });
  }
  return days;
}

// The append-only stock ledger: every receive, adjustment, hand-out and write-off.
export default function StockMovementsScreen() {
  const { project } = useControl();
  const [kind, setKind] = useState("all");
  const [recording, setRecording] = useState(false);
  const path = project ? `/api/control/inventory/${project.id}/movements${kind !== "all" ? `?kind=${kind}` : ""}` : null;
  const list = useControlQuery<{ movements: InventoryMovement[]; items: InventoryItem[] }>(path);
  const movements = list.data?.movements ?? [];

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in Control first." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load the ledger" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!movements.length) {
    body =
      kind !== "all" ? (
        <EmptyState icon="search" title="No movements of this kind" message="Try another filter." actionLabel="Show all" onAction={() => setKind("all")} />
      ) : (
        <EmptyState icon="arrow-left-right" title="No movements yet" message="Receiving, adjusting and issuing stock all land here." actionLabel="Record a movement" onAction={() => setRecording(true)} />
      );
  } else {
    body = (
      <View style={styles.days}>
        {byDay(movements).map((day, d) => (
          <Animated.View key={day.key} entering={FadeInDown.delay(stagger(d)).springify()}>
            <ListGroup title={day.title} action={<CountBadge value={day.rows.length} />}>
              {day.rows.map((m, i) => {
                const meta = MOVEMENT_META[m.kind] ?? { label: m.kind, tone: "neutral" as const };
                return (
                  <LedgerRow
                    key={m.id}
                    qty={m.qty}
                    kind={m.kind}
                    title={m.itemLabel ?? "Item"}
                    detail={[meta.label, m.reason, m.reference].filter(Boolean).join(" · ")}
                    when={fmtClock(m.createdAt)}
                    divider={i < day.rows.length - 1}
                  />
                );
              })}
            </ListGroup>
          </Animated.View>
        ))}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Stock movements"
          right={project ? <IconButton icon="plus" label="Record a movement" variant="solid" onPress={() => setRecording(true)} /> : undefined}
        />
      }
    >
      <Text style={styles.lede}>Stock only changes through this ledger. Fix a mistake with an opposite movement.</Text>
      {list.data ? (
        <View style={styles.controls}>
          <FilterChips options={FILTERS} value={kind} onChange={setKind} />
        </View>
      ) : null}
      {body}
      {project ? (
        <Sheet visible={recording} onClose={() => setRecording(false)} title="Record stock movement">
          <MovementForm
            projectId={project.id}
            items={list.data?.items ?? []}
            onClose={() => setRecording(false)}
            onRecorded={() => {
              setRecording(false);
              void list.reload();
            }}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  controls: {
    marginBottom: spacing.xl,
  },
  days: {
    gap: spacing.xl,
  },
});
