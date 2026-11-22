import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { Fact, Facts } from "@/components/control/money/Facts";
import { metaOf, REQUEST_STATUS } from "@/components/control/money/meta";
import { MoneyRow } from "@/components/control/money/MoneyRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn } from "@/lib/control_meta";
import { fmtDateTime, fmtShortDay } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { RefundRequest, RefundRequestList, RefundRequestStatus } from "@/types/control_money";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "Requested", label: "Requested" },
  { value: "Approved", label: "Approved" },
  { value: "Denied", label: "Denied" },
  { value: "Refunded", label: "Refunded" },
];

export default function RefundRequestsScreen() {
  const { project } = useControl();
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const path = project ? `/api/control/money/projects/${project.id}/refund-requests${status === "all" ? "" : `?status=${encodeURIComponent(status)}`}` : null;
  const list = useControlQuery<RefundRequestList>(path);
  const requests = list.data?.requests ?? [];
  const open = requests.find((r) => r.id === openId) ?? null;

  const replace = (next: RefundRequest) =>
    list.setData((prev) => (prev ? { ...prev, requests: prev.requests.map((r) => (r.id === next.id ? next : r)) } : prev));

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load refund requests" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!requests.length) {
    body =
      status === "all" ? (
        <EmptyState icon="undo-2" title="No refund requests" message="When buyers ask for a refund from the app or portal, it shows up here." />
      ) : (
        <EmptyState icon="undo-2" title={`Nothing ${status.toLowerCase()}`} message="Requests with this status show up here." actionLabel="Show all" onAction={() => setStatus("all")} />
      );
  } else {
    body = (
      <View style={styles.group}>
        {requests.map((r, i) => (
          <MoneyRow
            key={r.id}
            icon="undo-2"
            title={r.name || r.email || "Unknown buyer"}
            meta={[r.eventName, r.reason || "No reason given", fmtShortDay(r.createdAt)].filter(Boolean).join(" · ")}
            amount={moneyIn(r.amount, r.currency)}
            status={metaOf(REQUEST_STATUS, r.status)}
            onPress={() => setOpenId(r.id)}
            divider={i < requests.length - 1}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Refund requests" />}>
      <View style={styles.filters}>
        <FilterChips options={FILTERS} value={status} onChange={setStatus} />
      </View>
      {body}
      <Sheet visible={Boolean(open)} onClose={() => setOpenId(null)} title="Refund request">
        {open ? <RequestDetail request={open} canDecide={Boolean(list.data?.can.decide)} onChanged={replace} onClose={() => setOpenId(null)} /> : null}
      </Sheet>
    </Screen>
  );
}

// Lives inside the sheet body, which remounts on every open, so the amount starts from the request each time.
function RequestDetail({ request, canDecide, onChanged, onClose }: { request: RefundRequest; canDecide: boolean; onChanged: (r: RefundRequest) => void; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(request.amount ? request.amount.toFixed(2) : "");
  const [busy, setBusy] = useState<string | null>(null);
  const done = request.status === "Refunded";

  const fail = (message: string) => {
    errorFeedback();
    toast.error(message);
  };

  const refund = async () => {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return fail("Enter an amount above zero.");
    setBusy("refund");
    const res = await controlApi<{ request: RefundRequest; refunded: number }>(`/api/control/money/refund-requests/${request.id}/refund`, {
      method: "POST",
      body: { amount: value },
    });
    setBusy(null);
    if (!res.ok) return fail(res.error);
    successFeedback();
    toast.success(`Recorded a ${moneyIn(res.data.refunded, request.currency)} refund.`);
    onChanged(res.data.request);
    onClose();
  };

  const setStatus = async (status: RefundRequestStatus) => {
    setBusy(status);
    const res = await controlApi<{ request: RefundRequest }>(`/api/control/money/refund-requests/${request.id}`, { method: "PATCH", body: { status } });
    setBusy(null);
    if (!res.ok) return fail(res.error);
    successFeedback();
    toast.success(`Marked ${status.toLowerCase()}.`);
    onChanged(res.data.request);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.sheet}>
        <Facts>
          <Fact label="Buyer" value={[request.name, request.email].filter(Boolean).join(" · ") || "Unknown"} />
          <Fact label="Asked for" value={moneyIn(request.amount, request.currency)} />
          {request.eventName ? <Fact label="Event" value={request.eventName} /> : null}
          {request.orderCode ? <Fact label="Order" value={request.orderCode} mono /> : null}
          <Fact label="Received" value={fmtDateTime(request.createdAt)} />
          <Fact label="Reason" value={request.reason || "No reason given"} />
          <Fact label="Status" value={metaOf(REQUEST_STATUS, request.status).label} />
        </Facts>

        {canDecide && !done && request.orderId ? (
          <>
            <Field label="Refund amount" hint="This records the refund on the order. Return the money through your payment provider.">
              <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" selectTextOnFocus />
            </Field>
            <Button title="Refund now" icon="undo-2" onPress={() => void refund()} loading={busy === "refund"} disabled={busy !== null} fullWidth />
          </>
        ) : null}

        {canDecide && !done ? (
          <View style={styles.actions}>
            {request.status !== "Approved" ? (
              <View style={styles.action}>
                <Button title="Approve" variant="secondary" onPress={() => void setStatus("Approved")} loading={busy === "Approved"} disabled={busy !== null} fullWidth />
              </View>
            ) : null}
            {request.status === "Denied" ? (
              <View style={styles.action}>
                <Button title="Reopen" variant="secondary" onPress={() => void setStatus("Requested")} loading={busy === "Requested"} disabled={busy !== null} fullWidth />
              </View>
            ) : (
              <View style={styles.action}>
                <Button title="Deny" variant="destructiveGhost" onPress={() => void setStatus("Denied")} loading={busy === "Denied"} disabled={busy !== null} fullWidth />
              </View>
            )}
          </View>
        ) : null}

        {!canDecide ? <Text style={styles.note}>{"Your role can see requests but not decide them."}</Text> : null}

        {request.orderId ? (
          <Button
            title="View order"
            icon="receipt"
            variant="ghost"
            onPress={() => {
              onClose();
              router.push({ pathname: "/control/order/[id]", params: { id: request.orderId as string } });
            }}
            fullWidth
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  filters: {
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    gap: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
