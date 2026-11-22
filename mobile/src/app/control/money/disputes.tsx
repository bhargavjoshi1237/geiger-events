import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { Fact, Facts } from "@/components/control/money/Facts";
import { DISPUTE_STATUS, metaOf } from "@/components/control/money/meta";
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
import { fmtDate, fmtShortDay } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Dispute, DisputeList, DisputeStatus } from "@/types/control_money";

const STATUSES: DisputeStatus[] = ["Needs response", "Under review", "Won", "Lost"];
const FILTERS = [{ value: "all", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: s }))];

const dueDay = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function DisputesScreen() {
  const { project } = useControl();
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const path = project ? `/api/control/money/projects/${project.id}/disputes${status === "all" ? "" : `?status=${encodeURIComponent(status)}`}` : null;
  const list = useControlQuery<DisputeList>(path);
  const disputes = list.data?.disputes ?? [];
  const open = disputes.find((d) => d.id === openId) ?? null;

  const replace = (next: Dispute) =>
    list.setData((prev) => (prev ? { ...prev, disputes: prev.disputes.map((d) => (d.id === next.id ? next : d)) } : prev));

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load disputes" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!disputes.length) {
    body =
      status === "all" ? (
        <EmptyState icon="scale" title="No disputes" message="Chargebacks logged on the dashboard show up here." />
      ) : (
        <EmptyState icon="scale" title={`Nothing ${status.toLowerCase()}`} message="Disputes with this status show up here." actionLabel="Show all" onAction={() => setStatus("all")} />
      );
  } else {
    body = (
      <View style={styles.group}>
        {disputes.map((d, i) => (
          <MoneyRow
            key={d.id}
            icon="scale"
            title={d.name || d.email || (d.orderCode ? `Order ${d.orderCode}` : "Dispute")}
            meta={[d.eventName, d.reason, d.evidenceDueAt ? `Evidence by ${fmtDate(d.evidenceDueAt)}` : fmtShortDay(d.createdAt)].filter(Boolean).join(" · ")}
            amount={moneyIn(d.amount, d.currency)}
            status={metaOf(DISPUTE_STATUS, d.status)}
            onPress={() => setOpenId(d.id)}
            divider={i < disputes.length - 1}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Disputes & chargebacks" />}>
      <View style={styles.filters}>
        <FilterChips options={FILTERS} value={status} onChange={setStatus} />
      </View>
      {body}
      <Sheet visible={Boolean(open)} onClose={() => setOpenId(null)} title="Dispute">
        {open ? <DisputeDetail dispute={open} canDecide={Boolean(list.data?.can.decide)} onSaved={replace} onClose={() => setOpenId(null)} /> : null}
      </Sheet>
    </Screen>
  );
}

// Lives inside the sheet body, which remounts on every open, so the draft starts from the dispute as it is now.
function DisputeDetail({ dispute, canDecide, onSaved, onClose }: { dispute: Dispute; canDecide: boolean; onSaved: (d: Dispute) => void; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<string>(dispute.status);
  const [reason, setReason] = useState(dispute.reason);
  const [due, setDue] = useState(dueDay(dispute.evidenceDueAt));
  const [note, setNote] = useState(dispute.note);
  const [saving, setSaving] = useState(false);

  const changes: Record<string, string> = {};
  if (status !== dispute.status) changes.status = status;
  if (reason.trim() !== dispute.reason) changes.reason = reason.trim();
  if (due.trim() !== dueDay(dispute.evidenceDueAt)) changes.evidenceDue = due.trim();
  if (note !== dispute.note) changes.note = note;
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    setSaving(true);
    const res = await controlApi<{ dispute: Dispute }>(`/api/control/money/disputes/${dispute.id}`, { method: "PATCH", body: changes });
    setSaving(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Dispute updated.");
    onSaved(res.data.dispute);
    onClose();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.sheet}>
        <Facts>
          <Fact label="Buyer" value={[dispute.name, dispute.email].filter(Boolean).join(" · ") || "Unknown"} />
          <Fact label="Amount" value={moneyIn(dispute.amount, dispute.currency)} />
          {dispute.eventName ? <Fact label="Event" value={dispute.eventName} /> : null}
          {dispute.orderCode ? <Fact label="Order" value={dispute.orderCode} mono /> : null}
        </Facts>

        {canDecide ? (
          <>
            <Field label="Status">
              <FilterChips options={STATUSES.map((s) => ({ value: s, label: s }))} value={status} onChange={setStatus} />
            </Field>
            <Field label="Reason">
              <Input value={reason} onChangeText={setReason} placeholder="e.g. Not recognised" />
            </Field>
            <Field label="Evidence due" hint="YYYY-MM-DD; leave blank if there's no deadline.">
              <Input value={due} onChangeText={setDue} placeholder="2026-12-01" keyboardType="numbers-and-punctuation" />
            </Field>
            <Field label="Private note">
              <Input value={note} onChangeText={setNote} placeholder="What you sent, who you spoke to…" multiline textAlignVertical="top" style={styles.multiline} />
            </Field>
            <Button title="Save" onPress={() => void save()} loading={saving} disabled={!dirty || saving} fullWidth />
          </>
        ) : (
          <Facts>
            <Fact label="Status" value={metaOf(DISPUTE_STATUS, dispute.status).label} />
            <Fact label="Reason" value={dispute.reason || "—"} />
            <Fact label="Evidence due" value={dispute.evidenceDueAt ? fmtDate(dispute.evidenceDueAt) : "—"} />
            {dispute.note ? <Fact label="Note" value={dispute.note} /> : null}
          </Facts>
        )}

        {!canDecide ? <Text style={styles.note}>{"Your role can see disputes but not update them."}</Text> : null}

        {dispute.orderId ? (
          <Button
            title="View order"
            icon="receipt"
            variant="ghost"
            onPress={() => {
              onClose();
              router.push({ pathname: "/control/order/[id]", params: { id: dispute.orderId as string } });
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
  multiline: {
    minHeight: 90,
    paddingTop: spacing.md,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
