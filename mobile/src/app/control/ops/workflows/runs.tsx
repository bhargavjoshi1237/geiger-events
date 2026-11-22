import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDateTime } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing } from "@/theme/tokens";
import type { OpsRun } from "@/types/control_ops";

const RUN_STATUS: Record<OpsRun["status"], StatusMeta> = {
  Success: { label: "Success", tone: "success" },
  Failed: { label: "Failed", tone: "danger" },
  Running: { label: "Running", tone: "info" },
  Skipped: { label: "Skipped", tone: "neutral" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "Success", label: "Success" },
  { value: "Failed", label: "Failed" },
  { value: "Running", label: "Running" },
  { value: "Skipped", label: "Skipped" },
];

function duration(ms: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)} s`;
  return `${Math.round(ms / 60000)} min`;
}

export default function RunHistoryScreen() {
  const { project } = useControl();
  const [status, setStatus] = useState("all");
  const list = useControlQuery<{ runs: OpsRun[] }>(
    project ? `/api/control/ops/projects/${project.id}/workflow-runs${status !== "all" ? `?status=${status}` : ""}` : null,
  );
  const runs = list.data?.runs ?? [];

  return (
    <Screen scroll header={<ScreenHeader title="Run history" />}>
      <View style={styles.filters}>
        <FilterChips options={FILTERS} value={status} onChange={setStatus} />
      </View>
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load runs" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={6} variant="divided" />
      ) : !runs.length ? (
        status !== "all" ? (
          <EmptyState icon="search" title={`No ${status.toLowerCase()} runs`} message="Runs with this result will show up here." actionLabel="Show all runs" onAction={() => setStatus("all")} />
        ) : (
          <EmptyState icon="clock" title="No runs yet" message="Each time a workflow fires, its run appears here." />
        )
      ) : (
        <View style={styles.group}>
          {runs.map((r, i) => {
            const meta = RUN_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
            return (
              <ListRow
                key={r.id}
                leading={<IconTile icon={r.status === "Failed" ? "circle-x" : "workflow"} size={34} tone={r.status === "Failed" ? "danger" : "neutral"} />}
                title={r.workflowName || "Workflow"}
                subtitle={[
                  r.triggerLabel,
                  fmtDateTime(r.startedAt),
                  r.stepsTotal ? `${r.stepsCompleted}/${r.stepsTotal} steps` : "",
                  duration(r.durationMs),
                  r.error,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
                divider={i < runs.length - 1}
              />
            );
          })}
        </View>
      )}
    </Screen>
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
});
