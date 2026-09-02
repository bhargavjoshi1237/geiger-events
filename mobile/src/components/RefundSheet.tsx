import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, spacing, type } from "@/theme/tokens";

type RefundSheetProps = {
  visible: boolean;
  onClose: () => void;
  orderId: string;
};

export function RefundSheet({ visible, onClose, orderId }: RefundSheetProps) {
  const { token } = useSession();
  const { refreshAll } = usePortalData();
  const { success, error } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!token) return;
    if (!reason.trim()) return error("Please add a reason.");
    setBusy(true);
    const res = await api<{ ok?: boolean }>("/api/portal/refund", {
      method: "POST",
      token,
      body: { orderId, reason: reason.trim() },
    });
    setBusy(false);
    if (!res.ok) return error(res.error || "Couldn't submit your request.");
    success("Refund request sent to the organiser.");
    setReason("");
    onClose();
    void refreshAll();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Request A Refund">
      <View style={styles.form}>
        <Text style={styles.hint}>
          The organiser reviews this. You keep your ticket until they approve it.
        </Text>
        <Field label="Reason">
          <Input
            value={reason}
            onChangeText={setReason}
            placeholder="Tell the organiser why…"
            multiline
            style={styles.reason}
            textAlignVertical="top"
          />
        </Field>
        <View style={styles.actions}>
          <View style={styles.cancel}>
            <Button title="Cancel" variant="secondary" onPress={onClose} fullWidth />
          </View>
          <View style={styles.submit}>
            <Button title="Submit request" onPress={submit} loading={busy} fullWidth />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  hint: {
    ...type.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  reason: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md - 2,
  },
  cancel: {
    flex: 1,
  },
  submit: {
    flex: 1.4,
  },
});
