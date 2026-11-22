import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MOVEMENT_KINDS, MOVEMENT_META, signedQty } from "@/components/control/inventory/meta";
import { MovementForm } from "@/components/control/inventory/MovementForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDateTime } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { InventoryItem, InventoryMovement } from "@/types/control_inventory";

const FILTERS = [{ value: "all", label: "All" }, ...MOVEMENT_KINDS.map((k) => ({ value: k.value, label: MOVEMENT_META[k.value].label }))];

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
      <View style={styles.group}>
        {movements.map((m, i) => {
          const meta = MOVEMENT_META[m.kind] ?? { label: m.kind, tone: "neutral" as const };
          return (
            <ListRow
              key={m.id}
              title={`${signedQty(m.qty)} · ${m.itemLabel ?? "Item"}`}
              subtitle={[m.reason, m.reference, fmtDateTime(m.createdAt)].filter(Boolean).join(" · ")}
              trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
              divider={i < movements.length - 1}
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
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  controls: {
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
