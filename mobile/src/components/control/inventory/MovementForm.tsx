import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { MOVEMENT_KINDS, parseQty, qtyText } from "@/components/control/inventory/meta";
import { PickerField } from "@/components/control/inventory/PickerField";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";
import type { InventoryItem, InventoryMovement, MovementKind } from "@/types/control_inventory";

type Props = {
  projectId: string;
  items: InventoryItem[];
  itemId?: string;
  onClose: () => void;
  onRecorded: (result: { movement: InventoryMovement; item: InventoryItem }) => void;
};

// Records one ledger movement; the server signs it by kind and refuses to take stock below zero.
export function MovementForm({ projectId, items, itemId: fixedItem, onClose, onRecorded }: Props) {
  const toast = useToast();
  const [itemId, setItemId] = useState(fixedItem ?? "");
  const [kind, setKind] = useState<MovementKind>("receive");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const item = items.find((i) => i.id === itemId);
  const meta = MOVEMENT_KINDS.find((k) => k.value === kind);

  const submit = async () => {
    if (!itemId) return toast.error("Pick an item.");
    const value = parseQty(qty);
    if (value == null || value <= 0) return toast.error("Enter a quantity above zero.");
    setBusy(true);
    const res = await controlApi<{ movement: InventoryMovement; item: InventoryItem }>(`/api/control/inventory/${projectId}/movements`, {
      method: "POST",
      body: { itemId, kind, qty: value, direction, reason, note },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Stock updated.");
    onRecorded(res.data);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Text style={styles.note}>The ledger is append-only. Correct a mistake with an opposite movement.</Text>
        {fixedItem ? null : (
          <Field label="Item">
            <PickerField
              label="Item"
              placeholder="Choose an item"
              options={items.map((i) => ({ value: i.id, label: i.label, detail: `${qtyText(i.onHand)} on hand` }))}
              value={itemId}
              onChange={setItemId}
              emptyText="Add an item first."
            />
          </Field>
        )}
        <Field label="Movement">
          <FilterChips options={MOVEMENT_KINDS.map((k) => ({ value: k.value, label: k.label }))} value={kind} onChange={(v) => setKind(v as MovementKind)} />
        </Field>
        {meta?.direction === "either" ? (
          <Segmented
            options={[
              { value: "in", label: "Add to stock" },
              { value: "out", label: "Take from stock" },
            ]}
            value={direction}
            onChange={(v) => setDirection(v === "out" ? "out" : "in")}
          />
        ) : null}
        <Field label="Quantity" hint={item ? `${qtyText(item.onHand)} on hand now` : undefined}>
          <Input value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="0" />
        </Field>
        <Field label="Reason (optional)">
          <Input value={reason} onChangeText={setReason} placeholder="e.g. Delivery from supplier" />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChangeText={setNote} placeholder="Anything your team should know" />
        </Field>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Record" onPress={() => void submit()} loading={busy} />
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
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
