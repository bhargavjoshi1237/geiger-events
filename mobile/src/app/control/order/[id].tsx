import * as Crypto from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CoverWash } from "@/components/control/CoverWash";
import { localDay, signedMoney } from "@/components/control/money/ledger";
import { StatusButton } from "@/components/control/StatusButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn, ORDER_STATUS_META } from "@/lib/control_meta";
import { fmtDateTime } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { REFUND_STATUS, statusPill } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, spacing, type } from "@/theme/tokens";
import type { ControlAdmitResult, ControlOrder, ControlOrderDetail } from "@/types/portal";

const REFUND_REASONS = [
  { value: "requested_by_customer", label: "Buyer asked" },
  { value: "event_cancelled", label: "Event cancelled" },
  { value: "duplicate", label: "Duplicate" },
  { value: "fraudulent", label: "Fraudulent" },
  { value: "other", label: "Other" },
];

const reasonLabel = (code: string) => REFUND_REASONS.find((r) => r.value === code)?.label ?? "Other";
const stagger = (i: number) => Math.min(i, 8) * 50;

type SheetKind = "refund" | "edit" | "cancel" | null;
type ActionKey = "checkin" | "refund" | "edit" | "email" | "cancel";

export default function ControlOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload, setData } = useControlQuery<ControlOrderDetail>(`/api/control/orders/${id}`);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const order = data?.order;

  return (
    <Screen
      scroll
      backdrop={order ? <CoverWash numeral={localDay(order.createdAt)?.slice(8) ?? null} height={300} /> : undefined}
      header={<ScreenHeader title="Order" subtitle={order?.code} />}
    >
      {error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't open this order" message={error} actionLabel="Try again" onAction={() => void reload()} />
      ) : !data || !order ? (
        <SkeletonList rows={4} variant="card" />
      ) : (
        <OrderBody detail={data} onOpen={setSheet} />
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

function OrderBody({ detail, onOpen }: { detail: ControlOrderDetail; onOpen: (kind: SheetKind) => void }) {
  const { order, can, refunds, timeline } = detail;
  const status = ORDER_STATUS_META[order.status];
  const money = (n: number) => moneyIn(n, order.currency);
  const itemsTotal = Math.round(order.unitPrice * order.quantity * 100) / 100;
  // Whatever the ticket line doesn't explain (add-ons, discounts), so the column still sums to the total.
  const adjustment = Math.round((order.total - itemsTotal) * 100) / 100;
  const canCheckIn = can.checkIn && Boolean(order.eventId) && !order.cancelled && order.status !== "Refunded";
  const canRefund = can.refund && !order.cancelled && order.refundable > 0;
  const canCancel = can.refund && !order.cancelled;
  const actions: ActionKey[] = [];
  if (canCheckIn) actions.push("checkin");
  if (canRefund) actions.push("refund");
  if (can.refund) actions.push("edit");
  if (order.email) actions.push("email");
  if (canCancel) actions.push("cancel");
  let step = 0;

  const actionRow = (key: ActionKey, divider: boolean) => {
    if (key === "checkin" && order.eventId) return <CheckInRow key={key} eventId={order.eventId} orderId={order.id} quantity={order.quantity} divider={divider} />;
    if (key === "refund") {
      return <ListRow key={key} leading={<IconTile icon="undo-2" size={36} />} title="Refund" subtitle={`${money(order.refundable)} left on this order`} onPress={() => onOpen("refund")} divider={divider} />;
    }
    if (key === "edit") {
      return <ListRow key={key} leading={<IconTile icon="pencil" size={36} />} title="Edit buyer" subtitle="Name, email and private note" onPress={() => onOpen("edit")} divider={divider} />;
    }
    if (key === "email") {
      return <ListRow key={key} leading={<IconTile icon="mail" size={36} />} title="Email buyer" subtitle={order.email} onPress={() => void Linking.openURL(`mailto:${order.email}`)} divider={divider} />;
    }
    if (key === "cancel") {
      return (
        <ListRow
          key={key}
          leading={<IconTile icon="ban" size={36} tone="danger" />}
          title="Cancel order"
          subtitle="No money moves; seats and booths go back on sale"
          onPress={() => onOpen("cancel")}
          divider={divider}
        />
      );
    }
    return null;
  };

  return (
    <View style={styles.stack}>
      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.head}>
        <View style={styles.headTop}>
          <Avatar name={order.name} email={order.email} size={56} shape="square" />
          <View style={styles.headText}>
            <Text style={styles.name} numberOfLines={2}>
              {order.name || order.email || "No name given"}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {order.name ? order.email || "No email" : order.email ? "No name given" : "No email"}
            </Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <StatusButton label={status.label} tone={status.tone} />
          <Text style={styles.metaMono} numberOfLines={1}>
            {[order.code, fmtDateTime(order.createdAt)].filter(Boolean).join("  ·  ")}
          </Text>
        </View>
        {order.eventName ? (
          <View style={styles.eventLine}>
            <Icon name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.eventName} numberOfLines={1}>
              {order.eventName}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <Readout
          lead={{ label: "Total", value: money(order.total), hint: order.currency.toUpperCase() }}
          items={[
            { label: "Refunded", value: money(order.refunded), tone: order.refunded > 0 ? "info" : "neutral" },
            { label: "Left to refund", value: money(order.refundable) },
            { label: "Tickets", value: String(order.quantity) },
          ]}
        >
          {order.refunded > 0 && order.total > 0 ? (
            <TickMeter value={order.refunded} max={order.total} tone="info" ticks={44} height={12} label={`${money(order.refunded)} of ${money(order.total)} refunded`} />
          ) : null}
        </Readout>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <ListGroup title="Line items">
          <LedgerLine label={order.ticket || "Admission"} detail={`${order.quantity} × ${money(order.unitPrice)}`} amount={money(itemsTotal)} first />
          {adjustment !== 0 ? <LedgerLine label="Adjustments" amount={signedMoney(adjustment, order.currency, true)} /> : null}
          <LedgerLine label="Total" amount={money(order.total)} strong />
        </ListGroup>
      </Animated.View>

      {order.note ? (
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Private note" footer="Only your team sees this; it never reaches the buyer.">
            <Text style={styles.note}>{order.note}</Text>
          </ListGroup>
        </Animated.View>
      ) : null}

      {refunds.length ? (
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Refunds">
            {refunds.map((r, i) => {
              const pill = statusPill(REFUND_STATUS, r.status);
              return (
                <LedgerLine
                  key={r.id}
                  label={reasonLabel(r.reasonCode)}
                  sub={r.reason || undefined}
                  stamp={fmtDateTime(r.createdAt)}
                  amount={signedMoney(-r.amount, order.currency)}
                  tone="info"
                  pill={<Pill label={r.status} tone={pill.tone} variant="outline" />}
                  first={i === 0}
                />
              );
            })}
          </ListGroup>
        </Animated.View>
      ) : null}

      {timeline.length ? (
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Timeline">
            {timeline.map((t, i) => (
              <TimelineEntry
                key={t.id}
                title={t.summary || t.type}
                meta={[t.actor, fmtDateTime(t.createdAt)].filter(Boolean).join(" · ")}
                amount={t.amount != null ? money(t.amount) : undefined}
                first={i === 0}
                last={i === timeline.length - 1}
              />
            ))}
          </ListGroup>
        </Animated.View>
      ) : null}

      {actions.length ? (
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Actions">{actions.map((key, i) => actionRow(key, i < actions.length - 1))}</ListGroup>
        </Animated.View>
      ) : null}
    </View>
  );
}

type LedgerLineProps = {
  label: string;
  amount: string;
  detail?: string;
  sub?: string;
  stamp?: string;
  pill?: React.ReactNode;
  tone?: "info";
  strong?: boolean;
  first?: boolean;
};

// One statement line: what on the left, quantity × price in the middle, a right-aligned mono amount; totals sit under a heavier rule.
function LedgerLine({ label, amount, detail, sub, stamp, pill, tone, strong = false, first = false }: LedgerLineProps) {
  return (
    <View style={[styles.line, !first && (strong ? styles.lineTotal : styles.lineRuled)]}>
      <View style={styles.lineText}>
        <Text style={strong ? styles.lineLabelStrong : styles.lineLabel} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.lineSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
        {stamp ? <Text style={styles.lineStamp}>{stamp}</Text> : null}
      </View>
      {detail ? <Text style={styles.lineDetail}>{detail}</Text> : null}
      <View style={styles.lineRight}>
        <Text style={[strong ? styles.amountStrong : styles.amount, tone === "info" && styles.amountInfo]} numberOfLines={1}>
          {amount}
        </Text>
        {pill}
      </View>
    </View>
  );
}

// A step on the order's history, threaded on a rail so the sequence reads top to bottom.
function TimelineEntry({ title, meta, amount, first, last }: { title: string; meta: string; amount?: string; first: boolean; last: boolean }) {
  return (
    <View style={styles.entry}>
      <View style={styles.rail}>
        <View style={[styles.railStub, first && styles.railHidden]} />
        <View style={[styles.railDot, first && styles.railDotFirst]} />
        <View style={[styles.railFill, last && styles.railHidden]} />
      </View>
      <View style={styles.entryText}>
        <Text style={styles.entryTitle}>{title}</Text>
        {meta ? <Text style={styles.entryMeta}>{meta}</Text> : null}
      </View>
      {amount ? <Text style={styles.entryAmount}>{amount}</Text> : null}
    </View>
  );
}

// Ticket buyers live on orders, not the guest list, so the door can admit one found here by name.
function CheckInRow({ eventId, orderId, quantity, divider }: { eventId: string; orderId: string; quantity: number; divider: boolean }) {
  const { success, error, info } = useToast();
  const [busy, setBusy] = useState(false);

  const admit = async () => {
    if (busy) return;
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

  return (
    <ListRow
      leading={<IconTile icon="user-check" size={36} />}
      title={busy ? "Checking in…" : "Check in"}
      subtitle={quantity > 1 ? `Admit the ${quantity} tickets on this order at the door` : "Admit this buyer at the door"}
      trailing={busy ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : undefined}
      onPress={() => void admit()}
      divider={divider}
    />
  );
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
            <Button title="Save buyer" onPress={() => void submit()} loading={busy} />
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

const RAIL_DOT = 7;
// Centres the dot on the entry title's first line: 12pt top padding plus half a 20pt line, less half the dot.
const RAIL_STUB = 12 + 10 - RAIL_DOT / 2;

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  head: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  headTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  email: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm + 2,
  },
  metaMono: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  eventLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  eventName: {
    ...type.label,
    flexShrink: 1,
    color: colors.mutedForeground,
  },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 14,
  },
  lineRuled: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceHover,
  },
  lineTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
  },
  lineText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  lineLabel: {
    ...type.label,
    color: colors.foreground,
  },
  lineLabelStrong: {
    ...type.labelStrong,
    color: colors.foreground,
  },
  lineSub: {
    ...type.caption,
    color: colors.textSecondary,
  },
  lineStamp: {
    ...type.monoSmall,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textTertiary,
  },
  lineDetail: {
    ...type.monoSmall,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  lineRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  amount: {
    ...type.mono,
    fontSize: 14,
    lineHeight: 19,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  amountStrong: {
    ...type.figureSmall,
    fontSize: 16,
    lineHeight: 19,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  amountInfo: {
    color: colors.info,
  },
  note: {
    ...type.body,
    color: colors.foreground,
    paddingVertical: 14,
  },
  entry: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.md,
  },
  rail: {
    width: 12,
    alignItems: "center",
  },
  railStub: {
    width: StyleSheet.hairlineWidth * 2,
    height: RAIL_STUB,
    backgroundColor: colors.borderStrong,
  },
  railFill: {
    flex: 1,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.borderStrong,
  },
  railHidden: {
    backgroundColor: colors.canvasClear,
  },
  railDot: {
    width: RAIL_DOT,
    height: RAIL_DOT,
    borderRadius: RAIL_DOT / 2,
    backgroundColor: colors.textTertiary,
  },
  railDotFirst: {
    backgroundColor: colors.foreground,
  },
  entryText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingVertical: 12,
  },
  entryTitle: {
    ...type.label,
    lineHeight: 20,
    color: colors.foreground,
  },
  entryMeta: {
    ...type.monoSmall,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  entryAmount: {
    ...type.mono,
    paddingTop: 13,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
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
