import * as Crypto from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn, ORDER_STATUS_META } from "@/lib/control_meta";
import { fmtDateTime } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlAdmitResult, ControlOrder, ControlOrderDetail } from "@/types/portal";

const REFUND_REASONS = [
  { value: "requested_by_customer", label: "Buyer asked" },
  { value: "event_cancelled", label: "Event cancelled" },
  { value: "duplicate", label: "Duplicate" },
  { value: "fraudulent", label: "Fraudulent" },
  { value: "other", label: "Other" },
];

const reasonLabel = (code: string) => REFUND_REASONS.find((r) => r.value === code)?.label ?? "Other";

type SheetKind = "refund" | "edit" | "cancel" | null;

export default function ControlOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload, setData } = useControlQuery<ControlOrderDetail>(`/api/control/orders/${id}`);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const order = data?.order;

  return (
    <Screen scroll header={<ScreenHeader title="Order" subtitle={order?.code} />}>
      {error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't open this order" message={error} actionLabel="Try again" onAction={() => void reload()} />
      ) : !data || !order ? (
        <SkeletonList rows={4} variant="card" />
      ) : (
        <View style={styles.stack}>
          <Summary order={order} />

          {data.can.checkIn && order.eventId && !order.cancelled && order.status !== "Refunded" ? (
            <CheckInButton eventId={order.eventId} orderId={order.id} />
          ) : null}

          {data.can.refund ? (
            <View style={styles.actions}>
              {!order.cancelled && order.refundable > 0 ? (
                <View style={styles.action}>
                  <Button title="Refund" icon="undo-2" onPress={() => setSheet("refund")} fullWidth />
                </View>
              ) : null}
              <View style={styles.action}>
                <Button title="Edit buyer" icon="pencil" variant="secondary" onPress={() => setSheet("edit")} fullWidth />
              </View>
            </View>
          ) : null}

          <View>
            <SectionTitle>Buyer</SectionTitle>
            <View style={styles.group}>
              <ListRow leading={<IconTile icon="users" size={34} />} title={order.name || "No name given"} subtitle="Name" />
              <ListRow
                leading={<IconTile icon="mail" size={34} />}
                title={order.email || "No email"}
                subtitle="Email"
                onPress={order.email ? () => void Linking.openURL(`mailto:${order.email}`) : undefined}
                divider={false}
              />
            </View>
          </View>

          {order.note ? (
            <View>
              <SectionTitle>Private note</SectionTitle>
              <Card tone="subtle">
                <Text style={styles.note}>{order.note}</Text>
              </Card>
            </View>
          ) : null}

          {data.refunds.length ? (
            <View>
              <SectionTitle>Refunds</SectionTitle>
              <View style={styles.group}>
                {data.refunds.map((r, i) => (
                  <ListRow
                    key={r.id}
                    leading={<IconTile icon="undo-2" size={34} />}
                    title={moneyIn(r.amount, order.currency)}
                    subtitle={[reasonLabel(r.reasonCode), r.reason, fmtDateTime(r.createdAt)].filter(Boolean).join(" · ")}
                    trailing={<Pill label={r.status} tone="neutral" variant="outline" dot={false} />}
                    divider={i < data.refunds.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {data.timeline.length ? (
            <View>
              <SectionTitle>Timeline</SectionTitle>
              <View style={styles.group}>
                {data.timeline.map((t, i) => (
                  <ListRow
                    key={t.id}
                    leading={<IconTile icon="clock" size={34} />}
                    title={t.summary || t.type}
                    subtitle={[t.actor, fmtDateTime(t.createdAt)].filter(Boolean).join(" · ")}
                    divider={i < data.timeline.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {data.can.refund && !order.cancelled ? (
            <Button title="Cancel order" icon="ban" variant="destructiveGhost" onPress={() => setSheet("cancel")} fullWidth />
          ) : null}
        </View>
      )}

      {/* Mounted only while open so each opening starts from the order as it is now. */}
      {order && sheet === "refund" ? (
        <RefundSheet
          visible
          order={order}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            void reload();
          }}
        />
      ) : null}
      {order && sheet === "edit" ? (
        <EditBuyerSheet
          visible
          order={order}
          onClose={() => setSheet(null)}
          onSaved={(next) => {
            setSheet(null);
            setData(next);
          }}
        />
      ) : null}
      {order && sheet === "cancel" ? (
        <CancelSheet
          visible
          order={order}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            void reload();
          }}
        />
      ) : null}
    </Screen>
  );
}

function Summary({ order }: { order: ControlOrder }) {
  const meta = ORDER_STATUS_META[order.status];
  return (
    <Card>
      <View style={styles.summaryTop}>
        <Text style={styles.total}>{moneyIn(order.total, order.currency)}</Text>
        <Pill label={meta.label} tone={meta.tone} />
      </View>
      <Text style={styles.code}>{order.code}</Text>
      {order.eventName ? <Text style={styles.event}>{order.eventName}</Text> : null}
      <Text style={styles.meta}>
        {`${order.ticket || "Admission"} × ${order.quantity} · ${moneyIn(order.unitPrice, order.currency)} each`}
      </Text>
      <Text style={styles.meta}>{fmtDateTime(order.createdAt)}</Text>
      {order.refunded > 0 ? (
        <Text style={styles.refunded}>
          {`Refunded ${moneyIn(order.refunded, order.currency)}${order.cancelled ? "" : ` · ${moneyIn(order.refundable, order.currency)} left`}`}
        </Text>
      ) : null}
    </Card>
  );
}

// Ticket buyers live on orders, not the guest list, so the door can admit one found here by name.
function CheckInButton({ eventId, orderId }: { eventId: string; orderId: string }) {
  const { success, error, info } = useToast();
  const [busy, setBusy] = useState(false);

  const admit = async () => {
    setBusy(true);
    const res = await controlApi<ControlAdmitResult>(`/api/control/events/${eventId}/checkin`, {
      method: "POST",
      body: { orderId, method: "manual", clientId: Crypto.randomUUID() },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return error(res.error);
    }
    if (res.data.status === "admitted") {
      successFeedback();
      return success(res.data.message);
    }
    errorFeedback();
    if (res.data.status === "already") info(res.data.message);
    else error(res.data.status === "capacity" ? "This area is full. Override from the check-in screen." : res.data.message);
  };

  return <Button title="Check in" icon="user-check" variant="secondary" onPress={() => void admit()} loading={busy} fullWidth />;
}

type SheetProps = { visible: boolean; order: ControlOrder; onClose: () => void };

function RefundSheet({ visible, order, onClose, onDone }: SheetProps & { onDone: () => void }) {
  const { success, error } = useToast();
  const [amount, setAmount] = useState(order.refundable.toFixed(2));
  const [reasonCode, setReasonCode] = useState("requested_by_customer");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return error("Enter an amount above zero.");
    if (value > order.refundable) return error(`At most ${moneyIn(order.refundable, order.currency)} can be refunded.`);
    setBusy(true);
    const res = await controlApi<{ refunded: number }>(`/api/control/orders/${order.id}/refund`, {
      method: "POST",
      body: { amount: value, reasonCode, reason: reason.trim() },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      error(res.error);
      return;
    }
    successFeedback();
    success(`Recorded a ${moneyIn(value, order.currency)} refund.`);
    setReason("");
    onDone();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Refund order">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.form}>
          <Text style={styles.hint}>
            This records the refund on the order. Return the money through your payment provider, as you would from the dashboard.
          </Text>
          <Field label="Amount" hint={`${moneyIn(order.refundable, order.currency)} left on this order`}>
            <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" selectTextOnFocus />
          </Field>
          <View style={styles.quick}>
            <Button
              title={`Full refund · ${moneyIn(order.refundable, order.currency)}`}
              size="sm"
              variant="secondary"
              onPress={() => setAmount(order.refundable.toFixed(2))}
            />
          </View>
          <Field label="Reason">
            <FilterChips options={REFUND_REASONS} value={reasonCode} onChange={setReasonCode} />
          </Field>
          <Field label="Note (optional)">
            <Input
              value={reason}
              onChangeText={setReason}
              placeholder="Anything your team should know"
              multiline
              style={styles.multiline}
              textAlignVertical="top"
            />
          </Field>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Button title="Record refund" onPress={() => void submit()} loading={busy} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

function EditBuyerSheet({ visible, order, onClose, onSaved }: SheetProps & { onSaved: (next: ControlOrderDetail) => void }) {
  const { success, error } = useToast();
  const [name, setName] = useState(order.name);
  const [email, setEmail] = useState(order.email);
  const [note, setNote] = useState(order.note);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const body: { name?: string; email?: string; note?: string } = {};
    if (name.trim() !== order.name) body.name = name.trim();
    if (email.trim().toLowerCase() !== order.email) body.email = email.trim();
    if (note !== order.note) body.note = note;
    if (!Object.keys(body).length) return onClose();
    setBusy(true);
    const res = await controlApi<ControlOrderDetail>(`/api/control/orders/${order.id}`, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      error(res.error);
      return;
    }
    successFeedback();
    success("Order updated.");
    onSaved(res.data);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit buyer">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.form}>
          <Field label="Name">
            <Input value={name} onChangeText={setName} placeholder="Buyer name" autoCapitalize="words" />
          </Field>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="buyer@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <Field label="Private note" hint="Only your team sees this; it never reaches the buyer.">
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="Comped, swapped seats, …"
              multiline
              style={styles.multiline}
              textAlignVertical="top"
            />
          </Field>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Button title="Save" onPress={() => void submit()} loading={busy} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

function CancelSheet({ visible, order, onClose, onDone }: SheetProps & { onDone: () => void }) {
  const { success, error } = useToast();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await controlApi<{ cancelled: boolean }>(`/api/control/orders/${order.id}/cancel`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      error(res.error);
      return;
    }
    successFeedback();
    success("Order cancelled.");
    onDone();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Cancel this order?">
      <View style={styles.form}>
        <Text style={styles.hint}>
          {order.refundable > 0
            ? `No money moves when you cancel. Refund the ${moneyIn(order.refundable, order.currency)} left first if the buyer is owed it.`
            : "No money moves when you cancel."}{" "}
          Any seats or booths on the order go back on sale.
        </Text>
        <View style={styles.sheetActions}>
          <Button title="Keep order" variant="ghost" onPress={onClose} />
          <Button title="Cancel order" variant="destructive" onPress={() => void submit()} loading={busy} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  total: {
    ...type.display,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  code: {
    ...type.mono,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  event: {
    ...type.bodyStrong,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  meta: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  refunded: {
    ...type.captionStrong,
    color: colors.info,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  note: {
    ...type.body,
    color: colors.foreground,
  },
  form: {
    gap: spacing.lg,
  },
  hint: {
    ...type.body,
    color: colors.textSecondary,
  },
  quick: {
    flexDirection: "row",
    marginTop: -spacing.sm,
  },
  multiline: {
    minHeight: 88,
    paddingTop: spacing.md,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
