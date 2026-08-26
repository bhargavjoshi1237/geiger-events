import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { spacing } from "@/theme/tokens";

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
    <Sheet visible={visible} onClose={onClose} title="Request a refund">
      <View style={styles.form}>
        <Field label="Reason" hint="Tell the organiser why you can't attend.">
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
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Submit request" onPress={submit} loading={busy} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  reason: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
