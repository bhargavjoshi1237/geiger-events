import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CoverWash } from "@/components/control/CoverWash";
import { AllocationRow } from "@/components/control/inventory/AllocationRow";
import { ItemForm } from "@/components/control/inventory/ItemForm";
import { LedgerRow } from "@/components/control/inventory/LedgerRow";
import { ISSUANCE_LABEL, ITEM_CATEGORIES, MOVEMENT_META, parseQty, qtyText, STOCK_META } from "@/components/control/inventory/meta";
import { MovementForm } from "@/components/control/inventory/MovementForm";
import { StockRow } from "@/components/control/inventory/StockRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn } from "@/lib/control_meta";
import { fmtCompactTime } from "@/lib/format";
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

const stagger = (i: number) => Math.min(i, 8) * 50;

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
  const planned = allocations.reduce((sum, a) => sum + a.plannedQty, 0);
  const issued = allocations.reduce((sum, a) => sum + a.issuedQty, 0);
  // Stock still promised to events: what's planned but not yet handed out on any open allocation.
  const promised = allocations.filter((a) => a.status !== "Closed").reduce((sum, a) => sum + a.outstanding, 0);
  const facts = [item.sku, isVariant ? null : item.category].filter(Boolean).join(" · ");
  let step = 0;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {item.imageUrl ? (
        <View pointerEvents="none" style={styles.backdrop}>
          <CoverWash uri={item.imageUrl} height={300} />
        </View>
      ) : null}
      <ScreenHeader title={isVariant ? "Variant" : "Item"} right={<Button title="Save" size="sm" onPress={() => void save()} loading={saving} disabled={!dirty || saving} />} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.head}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} contentFit="cover" transition={150} style={styles.thumb} />
            ) : (
              <IconTile icon={isGroup ? "boxes" : "box"} size={64} tone={item.status === "Out of stock" ? "danger" : item.status === "Low stock" ? "warning" : "neutral"} />
            )}
            <View style={styles.headText}>
              <Text style={styles.name} numberOfLines={3}>
                {item.label}
              </Text>
              <View style={styles.metaRow}>
                <Pill label={meta.label} tone={meta.tone} />
                {facts ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {facts}
                  </Text>
                ) : null}
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Readout
              lead={{
                label: "On hand",
                value: qtyText(onHand),
                hint: item.reorderPoint ? `reorder at ${qtyText(item.reorderPoint)}` : "no reorder level",
                tone: item.status === "Out of stock" ? "danger" : item.status === "Low stock" ? "warning" : "neutral",
              }}
              items={[
                { label: "Allocated", value: qtyText(planned) },
                { label: "Issued", value: qtyText(issued) },
                { label: "Stock value", value: moneyIn(stockValue, item.currency), hint: "At unit cost" },
              ]}
            >
              {promised > 0 && onHand > 0 ? (
                <View style={styles.meterBlock}>
                  <TickMeter value={promised} max={onHand} ticks={44} height={16} tone="neutral" label={`${qtyText(promised)} of ${qtyText(onHand)} on hand promised to events`} />
                  <Text style={styles.meterFoot}>
                    {promised > onHand ? `${qtyText(promised - onHand)} short for open allocations` : `${qtyText(promised)} promised to events · ${qtyText(onHand - promised)} free`}
                  </Text>
                </View>
              ) : null}
            </Readout>
          </Animated.View>

          {/* A group's stock moves on its variants, and a variant can't have variants of its own. */}
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.actions}>
            {!isGroup ? (
              <View style={styles.action}>
                <Button title="Record movement" icon="arrow-left-right" onPress={() => setMoving(true)} fullWidth />
              </View>
            ) : null}
            {!isVariant ? (
              <View style={styles.action}>
                <Button title="Add variant" icon="plus" variant="secondary" onPress={() => setAddingVariant(true)} fullWidth />
              </View>
            ) : null}
          </Animated.View>

          {isGroup ? (
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title="Variants" footer="Stock moves on each variant; open one to record a movement.">
                {variants.map((v, i) => (
                  <StockRow
                    key={v.id}
                    title={v.variantLabel || v.label}
                    subtitle={v.sku || undefined}
                    imageUrl={v.imageUrl || undefined}
                    onHand={v.onHand}
                    status={v.status}
                    onPress={() => router.push({ pathname: "/control/inventory/item/[id]", params: { id: v.id } })}
                    divider={i < variants.length - 1}
                  />
                ))}
              </ListGroup>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Details">
              <View style={styles.fields}>
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
                <Field label="Description">
                  <Input value={draft.description} onChangeText={set("description")} multiline textAlignVertical="top" style={styles.multiline} />
                </Field>
              </View>
            </ListGroup>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Pricing and reorder">
              <View style={styles.fields}>
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
              </View>
            </ListGroup>
          </Animated.View>

          {allocations.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title="Allocated to events">
                {allocations.map((a, i) => (
                  <AllocationRow
                    key={a.id}
                    title={a.eventName}
                    subtitle={ISSUANCE_LABEL[a.issuance] ?? a.issuance}
                    issued={a.issuedQty}
                    planned={a.plannedQty}
                    status={a.status}
                    divider={i < allocations.length - 1}
                  />
                ))}
              </ListGroup>
            </Animated.View>
          ) : null}

          {movements.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <ListGroup title="Ledger" footer="The latest movements. Fix a mistake with an opposite movement.">
                {movements.map((m, i) => (
                  <LedgerRow
                    key={m.id}
                    qty={m.qty}
                    kind={m.kind}
                    title={MOVEMENT_META[m.kind]?.label ?? m.kind}
                    detail={[m.reason, m.reference].filter(Boolean).join(" · ") || undefined}
                    when={fmtCompactTime(m.createdAt)}
                    divider={i < movements.length - 1}
                  />
                ))}
              </ListGroup>
            </Animated.View>
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
          <View style={styles.sheetActions}>
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
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
    alignItems: "center",
    gap: spacing.md + 2,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  meta: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  meterBlock: {
    gap: spacing.sm,
  },
  meterFoot: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  fields: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
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
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
