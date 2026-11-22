import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { DataRequest, DataRequestStatus } from "@/types/control_guests";

const STATUSES: DataRequestStatus[] = ["New", "In Progress", "Completed", "Rejected"];

const STATUS_META: Record<DataRequestStatus, StatusMeta> = {
  New: { label: "New", tone: "neutral" },
  "In Progress": { label: "In progress", tone: "warning" },
  Completed: { label: "Completed", tone: "success" },
  Rejected: { label: "Rejected", tone: "neutral" },
};

const open = (r: DataRequest) => r.status === "New" || r.status === "In Progress";

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

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load requests" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!requests.length) {
    body = <EmptyState icon="shield-check" title="No data requests" message="Export, erasure and rectification requests are logged on the dashboard and tracked here." />;
  } else if (!shown.length) {
    body = <EmptyState icon="circle-check" title="Nothing here" message="No requests with this status." actionLabel="Show all" onAction={() => setFilter("all")} />;
  } else {
    body = (
      <View style={styles.group}>
        {shown.map((r, i) => {
          const meta = STATUS_META[r.status] ?? { label: r.status, tone: "neutral" as const };
          const overdue = r.overdue;
          return (
            <ListRow
              key={r.id}
              leading={<IconTile icon="shield-check" size={34} tone={overdue ? "danger" : "neutral"} />}
              title={`${r.type} · ${r.email || "No email"}`}
              subtitle={r.dueAt && open(r) ? `${overdue ? "Overdue" : "Due"} ${fmtDate(r.dueAt)}` : undefined}
              trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
              onPress={() => setSelected(r)}
              divider={i < shown.length - 1}
            />
          );
        })}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Data Requests" />}>
      <View style={styles.filters}>
        <FilterChips
          options={[{ value: "open", label: "Open" }, { value: "all", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))]}
          value={filter}
          onChange={setFilter}
        />
      </View>
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

  return (
    <View style={styles.form}>
      <Text style={styles.detail}>{request.email || "No email"}</Text>
      {request.note ? <Text style={styles.meta}>{request.note}</Text> : null}
      <Text style={styles.meta}>
        {[request.createdAt && `Logged ${fmtDate(request.createdAt)}`, request.dueAt && `due ${fmtDate(request.dueAt)}`, request.resolvedAt && `closed ${fmtDate(request.resolvedAt)}`]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      <Field label="Status">
        <FilterChips options={STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))} value={request.status} onChange={(s) => void setStatus(s)} />
      </Field>
    </View>
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
  form: {
    gap: spacing.md,
  },
  detail: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
