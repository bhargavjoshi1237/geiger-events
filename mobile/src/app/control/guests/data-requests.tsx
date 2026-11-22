import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DateStub } from "@/components/control/DateStub";
import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import type { IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate, relativeDayLabel } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { DataRequest, DataRequestStatus } from "@/types/control_guests";

const STATUSES: DataRequestStatus[] = ["New", "In Progress", "Completed", "Rejected"];

const STATUS_META: Record<DataRequestStatus, StatusMeta> = {
  New: { label: "New", tone: "neutral" },
  "In Progress": { label: "In progress", tone: "warning" },
  Completed: { label: "Completed", tone: "success" },
  Rejected: { label: "Rejected", tone: "neutral" },
};

const TYPE_ICON: Record<string, IconName> = { Export: "share", Erasure: "trash-2", Rectification: "square-pen" };

const stagger = (i: number) => Math.min(i, 8) * 50;
const open = (r: DataRequest) => r.status === "New" || r.status === "In Progress";
const metaOf = (r: DataRequest): StatusMeta => STATUS_META[r.status] ?? { label: r.status, tone: "neutral" };

// What the row says under the email: the kind of request, then where it stands against its due date.
function standing(r: DataRequest): string {
  if (r.overdue) return `${r.type} · ${metaOf(r).label}`;
  if (open(r)) return r.dueAt ? `${r.type} · due ${relativeDayLabel(r.dueAt).toLowerCase()}` : `${r.type} request`;
  return r.resolvedAt ? `${r.type} · closed ${fmtDate(r.resolvedAt)}` : `${r.type} request`;
}

// Privacy requests (export, erasure, rectification): track them here; the data work itself happens on the dashboard.
export default function DataRequestsScreen() {
  const { project } = useControl();
  const list = useControlQuery<{ requests: DataRequest[] }>(project ? `/api/control/guests/projects/${project.id}/data-requests` : null);
  const [filter, setFilter] = useState("open");
  const [selected, setSelected] = useState<DataRequest | null>(null);
  const requests = list.data?.requests ?? [];
  const shown = requests.filter((r) => (filter === "open" ? open(r) : filter === "all" ? true : r.status === filter));

  const replace = (next: DataRequest) =>
    list.setData((prev) => (prev ? { requests: prev.requests.map((r) => (r.id === next.id ? next : r)) } : prev));

  const openCount = requests.filter(open).length;
  const overdue = requests.filter((r) => r.overdue).length;
  const byStatus = (s: DataRequestStatus) => requests.filter((r) => r.status === s).length;
  const filterOptions = [
    { value: "open", label: "Open", count: list.data ? openCount : null },
    { value: "all", label: "All", count: list.data ? requests.length : null },
    ...STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, count: list.data ? byStatus(s) : null })),
  ];
  const filterLabel = filter === "open" ? "Open requests" : filter === "all" ? "All requests" : STATUS_META[filter as DataRequestStatus]?.label ?? filter;

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load requests" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!requests.length) {
    body = <EmptyState icon="shield-check" title="No data requests" message="Export, erasure and rectification requests are logged on the dashboard and tracked here." />;
  } else {
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout
            lead={{ label: "Open", value: String(openCount), hint: `of ${requests.length}`, tone: openCount ? "warning" : "neutral" }}
            items={[
              { label: "Overdue", value: String(overdue), tone: overdue ? "danger" : "neutral" },
              { label: "In progress", value: String(byStatus("In Progress")) },
              { label: "Closed", value: String(byStatus("Completed") + byStatus("Rejected")) },
            ]}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
          <FilterChips options={filterOptions} value={filter} onChange={setFilter} />
        </Animated.View>
        {!shown.length ? (
          <EmptyState icon="circle-check" title="Nothing here" message="No requests with this status." actionLabel="Show all" onAction={() => setFilter("all")} />
        ) : (
          <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
            <ListGroup title={filterLabel} footer="Each request is dated by when it's due.">
              {shown.map((r, i) => {
                const meta = metaOf(r);
                return (
                  <ListRow
                    key={r.id}
                    leading={<DateStub date={r.dueAt} muted={!open(r)} />}
                    title={r.email || "No email"}
                    subtitle={standing(r)}
                    trailing={r.overdue ? <Pill label="Overdue" tone="danger" /> : <Pill label={meta.label} tone={meta.tone} variant="outline" />}
                    onPress={() => setSelected(r)}
                    divider={i < shown.length - 1}
                  />
                );
              })}
            </ListGroup>
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Data Requests" />}>
      {body}
      <Sheet visible={selected !== null} onClose={() => setSelected(null)} title={selected ? `${selected.type} request` : "Request"}>
        {selected ? (
          <RequestForm
            request={selected}
            onChanged={(next) => {
              replace(next);
              setSelected(next);
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

function RequestForm({ request, onChanged }: { request: DataRequest; onChanged: (next: DataRequest) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const meta = metaOf(request);

  const setStatus = async (status: string) => {
    if (busy || status === request.status) return;
    setBusy(true);
    const res = await controlApi<{ request: DataRequest }>(`/api/control/guests/data-requests/${request.id}`, { method: "PATCH", body: { status } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`Marked ${STATUS_META[res.data.request.status]?.label.toLowerCase() ?? res.data.request.status}.`);
    onChanged(res.data.request);
  };

  const facts = [
    { label: "Logged", value: fmtDate(request.createdAt) },
    { label: request.overdue ? "Was due" : "Due", value: fmtDate(request.dueAt) },
    { label: "Closed", value: fmtDate(request.resolvedAt) },
  ].filter((f) => f.value);

  return (
    <View style={styles.form}>
      <View style={styles.head}>
        <IconTile icon={TYPE_ICON[request.type] ?? "shield-check"} size={44} tone={request.overdue ? "danger" : "neutral"} />
        <View style={styles.headText}>
          <Text style={styles.email} numberOfLines={1}>
            {request.email || "No email"}
          </Text>
          <View style={styles.pills}>
            <Pill label={meta.label} tone={meta.tone} />
            {request.overdue ? <Pill label="Overdue" tone="danger" /> : null}
          </View>
        </View>
      </View>
      {request.note ? <Text style={styles.note}>{request.note}</Text> : null}
      {facts.length ? (
        <ListGroup>
          {facts.map((f, i) => (
            <DetailRow key={f.label} label={f.label} value={f.value} mono divider={i < facts.length - 1} />
          ))}
        </ListGroup>
      ) : null}
      <Field label="Status" hint="The export or erasure itself is done on the dashboard.">
        <FilterChips options={STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))} value={request.status} onChange={(s) => void setStatus(s)} />
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs + 2,
  },
  email: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  note: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
});
