import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { ITEM_CATEGORIES, parseQty } from "@/components/control/inventory/meta";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";
import type { InventoryItem } from "@/types/control_inventory";

type Props = {
  projectId: string;
  parent?: InventoryItem | null;
  onClose: () => void;
  onCreated: (item: InventoryItem) => void;
};

// A new item, or a variant of `parent` (which takes the parent's name and category); opening stock is recorded as a receive.
export function ItemForm({ projectId, parent = null, onClose, onCreated }: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [variantLabel, setVariantLabel] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Merch");
  const [unitCost, setUnitCost] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!parent && !name.trim()) return toast.error("Give the item a name.");
    if (parent && !variantLabel.trim()) return toast.error("Name the variant, e.g. Large.");
    const body: Record<string, unknown> = {
      sku,
      unitCost: parseQty(unitCost) ?? 0,
      unitPrice: parseQty(unitPrice) ?? 0,
      reorderPoint: parseQty(reorderPoint) ?? 0,
      openingStock: parseQty(openingStock) ?? 0,
    };
    if (parent) {
      body.parentId = parent.id;
      body.variantLabel = variantLabel;
    } else {
      body.name = name;
      body.category = category;
    }
    setBusy(true);
    const res = await controlApi<{ item: InventoryItem }>(`/api/control/inventory/${projectId}/items`, { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(parent ? "Variant added." : "Item created.");
    onCreated(res.data.item);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        {parent ? (
          <>
            <Text style={styles.note}>{`A variant of ${parent.name}, sharing its name and category.`}</Text>
            <Field label="Variant">
              <Input value={variantLabel} onChangeText={setVariantLabel} placeholder="e.g. Large" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Name">
              <Input value={name} onChangeText={setName} placeholder="e.g. Event tee" />
            </Field>
            <Field label="Category">
              <FilterChips options={ITEM_CATEGORIES.map((c) => ({ value: c, label: c }))} value={category} onChange={setCategory} />
            </Field>
          </>
        )}
        <Field label="SKU (optional)">
          <Input value={sku} onChangeText={setSku} placeholder="e.g. TEE-L" autoCapitalize="characters" />
        </Field>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Field label="Unit cost">
              <Input value={unitCost} onChangeText={setUnitCost} keyboardType="decimal-pad" placeholder="0" />
            </Field>
          </View>
          <View style={styles.cell}>
            <Field label="Unit price">
              <Input value={unitPrice} onChangeText={setUnitPrice} keyboardType="decimal-pad" placeholder="0" />
            </Field>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Field label="Reorder at">
              <Input value={reorderPoint} onChangeText={setReorderPoint} keyboardType="decimal-pad" placeholder="0" />
            </Field>
          </View>
          <View style={styles.cell}>
            <Field label="Opening stock">
              <Input value={openingStock} onChangeText={setOpeningStock} keyboardType="decimal-pad" placeholder="0" />
            </Field>
          </View>
        </View>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title={parent ? "Add variant" : "Create item"} onPress={() => void submit()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
