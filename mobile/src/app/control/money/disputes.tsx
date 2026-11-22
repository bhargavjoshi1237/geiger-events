import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Fact, Facts } from "@/components/control/money/Facts";
import { localDay, totalIn } from "@/components/control/money/ledger";
import { DISPUTE_STATUS, metaOf } from "@/components/control/money/meta";
import { MoneyRow } from "@/components/control/money/MoneyRow";
import { RecordHead } from "@/components/control/money/RecordHead";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout, type ReadoutFigure } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn } from "@/lib/control_meta";
import { fmtDate } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { Dispute, DisputeList, DisputeStatus } from "@/types/control_money";

const STATUSES: DisputeStatus[] = ["Needs response", "Under review", "Won", "Lost"];
const FILTERS = [{ value: "all", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: s }))];
const OPEN: DisputeStatus[] = ["Needs response", "Under review"];
const stagger = (i: number) => Math.min(i, 8) * 50;

const dueDay = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function disputed(rows: Dispute[]): string | undefined {
  const sum = totalIn(rows, (d) => d.amount, (d) => d.currency);
  return sum ? `${moneyIn(sum.total, sum.currency)} disputed` : undefined;
}

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
    const focal = status === "all" ? "Needs response" : status;
    const focalRows = disputes.filter((d) => d.status === focal);
    const lead: ReadoutFigure = {
      label: focal,
      value: String(focalRows.length),
      hint: disputed(focalRows),
      tone: focal === "Needs response" && focalRows.length ? "warning" : "neutral",
    };
    const items: ReadoutFigure[] =
      status === "all" ? (["Under review", "Won", "Lost"] as const).map((s) => ({ label: s, value: String(disputes.filter((d) => d.status === s).length) })) : [];
    const groups = [
      { key: "open", title: "Open", rows: disputes.filter((d) => OPEN.includes(d.status)) },
      { key: "resolved", title: "Resolved", rows: disputes.filter((d) => !OPEN.includes(d.status)) },
    ].filter((g) => g.rows.length);

    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout lead={lead} items={items} />
        </Animated.View>
        {groups.map((group, gi) => (
          <Animated.View key={group.key} entering={FadeInDown.delay(stagger(gi + 1)).springify()}>
            <ListGroup title={group.title} action={<CountBadge value={group.rows.length} />}>
              {group.rows.map((d, i) => (
                <MoneyRow
                  key={d.id}
                  date={localDay(d.createdAt)}
                  title={d.name || d.email || (d.orderCode ? `Order ${d.orderCode}` : "Dispute")}
                  meta={[d.eventName, d.reason].filter(Boolean).join(" · ") || "No reason logged"}
                  code={d.orderCode || undefined}
                  amount={moneyIn(d.amount, d.currency)}
                  status={metaOf(DISPUTE_STATUS, d.status)}
                  flag={
                    d.evidenceDueAt && OPEN.includes(d.status)
                      ? { label: `Evidence due ${fmtDate(d.evidenceDueAt)}`, tone: d.status === "Needs response" ? "warning" : "neutral" }
                      : null
                  }
                  onPress={() => setOpenId(d.id)}
                  divider={i < group.rows.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
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
        <RecordHead
          at={dispute.createdAt}
          title={dispute.name || dispute.email || "Unknown buyer"}
          subtitle={dispute.name && dispute.email ? dispute.email : undefined}
          amount={moneyIn(dispute.amount, dispute.currency)}
          status={metaOf(DISPUTE_STATUS, dispute.status)}
        />

        {dispute.eventName || dispute.orderCode || !canDecide ? (
          <Facts>
            {dispute.eventName ? <Fact label="Event" value={dispute.eventName} /> : null}
            {dispute.orderCode ? <Fact label="Order" value={dispute.orderCode} mono /> : null}
            {!canDecide ? <Fact label="Reason" value={dispute.reason || "—"} /> : null}
            {!canDecide ? <Fact label="Evidence due" value={dispute.evidenceDueAt ? fmtDate(dispute.evidenceDueAt) : "—"} mono /> : null}
            {!canDecide && dispute.note ? <Fact label="Note" value={dispute.note} block /> : null}
          </Facts>
        ) : null}

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
            <Button title="Save changes" onPress={() => void save()} loading={saving} disabled={!dirty || saving} fullWidth />
          </>
        ) : (
          <Text style={styles.note}>{"Your role can see disputes but not update them."}</Text>
        )}

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
  stack: {
    gap: spacing.xl,
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
