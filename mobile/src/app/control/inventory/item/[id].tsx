import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ItemForm } from "@/components/control/inventory/ItemForm";
import { ALLOCATION_META, ITEM_CATEGORIES, MOVEMENT_META, parseQty, qtyText, signedQty, STOCK_META } from "@/components/control/inventory/meta";
import { MovementForm } from "@/components/control/inventory/MovementForm";
import { StatTile } from "@/components/control/StatTile";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn } from "@/lib/control_meta";
import { fmtDateTime } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { InventoryAllocation, InventoryItem, InventoryMovement } from "@/types/control_inventory";

type Detail = {
  item: InventoryItem;
  variants: InventoryItem[];
  movements: InventoryMovement[];
  allocations: (InventoryAllocation & { eventName: string })[];
};

export default function InventoryItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { project } = useControl();
  const query = useControlQuery<Detail>(project ? `/api/control/inventory/${project.id}/items/${id}` : null);

  if (query.data && project) {
    // Keyed by the item so a save or a stock change re-seeds the form from the server.
    return <ItemEditor key={JSON.stringify(query.data.item)} detail={query.data} projectId={project.id} onChanged={() => void query.reload()} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Item" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {query.error ? (
          <EmptyState icon="circle-alert" title="Couldn't open this item" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
        ) : (
          <SkeletonList rows={4} variant="card" />
        )}
      </ScrollView>
    </View>
  );
}

function ItemEditor({ detail, projectId, onChanged }: { detail: Detail; projectId: string; onChanged: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { item, variants, movements, allocations } = detail;
  const isVariant = Boolean(item.parentId);
  const isGroup = variants.length > 0;
  const [draft, setDraft] = useState({
    name: item.name,
    variantLabel: item.variantLabel,
    sku: item.sku,
    category: item.category,
    description: item.description,
    unitCost: String(item.unitCost),
    unitPrice: String(item.unitPrice),
    reorderPoint: String(item.reorderPoint),
  });
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (key: keyof typeof draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const changes: Record<string, unknown> = {};
  if (!isVariant && draft.name.trim() !== item.name) changes.name = draft.name;
  if (isVariant && draft.variantLabel.trim() !== item.variantLabel) changes.variantLabel = draft.variantLabel;
  if (draft.sku.trim() !== item.sku) changes.sku = draft.sku;
  if (!isVariant && draft.category !== item.category) changes.category = draft.category;
  if (draft.description.trim() !== item.description) changes.description = draft.description;
  for (const key of ["unitCost", "unitPrice", "reorderPoint"] as const) {
    const n = parseQty(draft[key]) ?? 0;
    if (n !== item[key]) changes[key] = n;
  }
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    setSaving(true);
    const res = await controlApi<{ item: InventoryItem }>(`/api/control/inventory/${projectId}/items/${item.id}`, { method: "PATCH", body: changes });
    setSaving(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Item saved.");
    onChanged();
  };

  const remove = async () => {
    setDeleting(true);
    const res = await controlApi<{ deleted: boolean }>(`/api/control/inventory/${projectId}/items/${item.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    setConfirmDelete(false);
    successFeedback();
    toast.success("Item deleted.");
    router.back();
  };

  const meta = STOCK_META[item.status];
  const stockValue = (isGroup ? variants : [item]).reduce((sum, v) => sum + v.onHand * v.unitCost, 0);
  const onHand = isGroup ? variants.reduce((sum, v) => sum + v.onHand, 0) : item.onHand;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title={isVariant ? "Variant" : "Item"} subtitle={item.sku || undefined} right={<Button title="Save" size="sm" onPress={() => void save()} loading={saving} disabled={!dirty || saving} />} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          <View style={styles.head}>
            <Text style={styles.name}>{item.label}</Text>
            <Pill label={meta.label} tone={meta.tone} />
          </View>
          <View style={styles.stats}>
            <StatTile label="On hand" value={qtyText(onHand)} hint={item.reorderPoint ? `Reorder at ${qtyText(item.reorderPoint)}` : undefined} />
            <StatTile label="Stock value" value={moneyIn(stockValue, item.currency)} hint="At unit cost" />
          </View>

          {isGroup ? (
            <View>
              <SectionTitle variant="kicker">Variants</SectionTitle>
              <View style={styles.group}>
                {variants.map((v, i) => (
                  <ListRow
                    key={v.id}
                    leading={<IconTile icon="box" size={34} tone={v.status === "Out of stock" ? "danger" : "neutral"} />}
                    title={v.variantLabel || v.label}
                    subtitle={`${qtyText(v.onHand)} on hand${v.sku ? ` · ${v.sku}` : ""}`}
                    trailing={<Pill label={STOCK_META[v.status].label} tone={STOCK_META[v.status].tone} variant="outline" />}
                    onPress={() => router.push({ pathname: "/control/inventory/item/[id]", params: { id: v.id } })}
                    divider={i < variants.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : (
            <Button title="Record a stock movement" icon="arrow-left-right" onPress={() => setMoving(true)} fullWidth />
          )}
          {!isVariant ? <Button title="Add a variant" icon="plus" variant="secondary" onPress={() => setAddingVariant(true)} fullWidth /> : null}

          <View>
            <SectionTitle variant="kicker">Details</SectionTitle>
            <View style={styles.card}>
              {isVariant ? (
                <Field label="Variant">
                  <Input value={draft.variantLabel} onChangeText={set("variantLabel")} placeholder="e.g. Large" />
                </Field>
              ) : (
                <Field label="Name">
                  <Input value={draft.name} onChangeText={set("name")} />
                </Field>
              )}
              <Field label="SKU">
                <Input value={draft.sku} onChangeText={set("sku")} autoCapitalize="characters" />
              </Field>
              {!isVariant ? (
                <Field label="Category">
                  <FilterChips options={ITEM_CATEGORIES.map((c) => ({ value: c, label: c }))} value={draft.category} onChange={set("category")} />
                </Field>
              ) : null}
              <View style={styles.row}>
                <View style={styles.cell}>
                  <Field label="Unit cost">
                    <Input value={draft.unitCost} onChangeText={set("unitCost")} keyboardType="decimal-pad" />
                  </Field>
                </View>
                <View style={styles.cell}>
                  <Field label="Unit price">
                    <Input value={draft.unitPrice} onChangeText={set("unitPrice")} keyboardType="decimal-pad" />
                  </Field>
                </View>
              </View>
              <Field label="Reorder at" hint="Low-stock warning level; 0 turns it off.">
                <Input value={draft.reorderPoint} onChangeText={set("reorderPoint")} keyboardType="decimal-pad" />
              </Field>
              <Field label="Description">
                <Input value={draft.description} onChangeText={set("description")} multiline textAlignVertical="top" style={styles.multiline} />
              </Field>
            </View>
          </View>

          {allocations.length ? (
            <View>
              <SectionTitle variant="kicker">Allocated to events</SectionTitle>
              <View style={styles.group}>
                {allocations.map((a, i) => (
                  <ListRow
                    key={a.id}
                    leading={<IconTile icon="calendar-check" size={34} />}
                    title={a.eventName}
                    subtitle={`${qtyText(a.issuedQty)} of ${qtyText(a.plannedQty)} issued`}
                    trailing={<Pill label={ALLOCATION_META[a.status]?.label ?? a.status} tone={ALLOCATION_META[a.status]?.tone ?? "neutral"} variant="outline" />}
                    divider={i < allocations.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {movements.length ? (
            <View>
              <SectionTitle variant="kicker">Recent movements</SectionTitle>
              <View style={styles.group}>
                {movements.map((m, i) => (
                  <ListRow
                    key={m.id}
                    title={`${signedQty(m.qty)} · ${MOVEMENT_META[m.kind]?.label ?? m.kind}`}
                    subtitle={[m.reason, fmtDateTime(m.createdAt)].filter(Boolean).join(" · ")}
                    divider={i < movements.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Button title={isGroup ? "Delete item and its variants" : "Delete item"} icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
        </View>
      </ScrollView>

      <Sheet visible={moving} onClose={() => setMoving(false)} title="Record stock movement">
        <MovementForm
          projectId={projectId}
          items={[item]}
          itemId={item.id}
          onClose={() => setMoving(false)}
          onRecorded={() => {
            setMoving(false);
            onChanged();
          }}
        />
      </Sheet>
      <Sheet visible={addingVariant} onClose={() => setAddingVariant(false)} title="New variant">
        <ItemForm
          projectId={projectId}
          parent={item}
          onClose={() => setAddingVariant(false)}
          onCreated={() => {
            setAddingVariant(false);
            onChanged();
          }}
        />
      </Sheet>
      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${item.label}?`}>
        <View style={styles.sheetBody}>
          <Text style={styles.muted}>It leaves the catalogue. Its movement history stays in the ledger.</Text>
          <View style={styles.actions}>
            <Button title="Keep it" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete" variant="destructive" onPress={() => void remove()} loading={deleting} />
          </View>
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.xl,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: {
    ...type.title,
    flex: 1,
    color: colors.foreground,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.md,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
  multiline: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  muted: {
    ...type.body,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
