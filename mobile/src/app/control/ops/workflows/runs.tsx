import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import type { IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtClock, fmtShortDay, isToday } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { OpsRun } from "@/types/control_ops";

const RUN_STATUS: Record<OpsRun["status"], StatusMeta & { icon: IconName; tile: "success" | "danger" | "info" | "outline" }> = {
  Success: { label: "Success", tone: "success", icon: "circle-check", tile: "success" },
  Failed: { label: "Failed", tone: "danger", icon: "circle-x", tile: "danger" },
  Running: { label: "Running", tone: "info", icon: "refresh-cw", tile: "info" },
  Skipped: { label: "Skipped", tone: "neutral", icon: "ban", tile: "outline" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "Success", label: "Success" },
  { value: "Failed", label: "Failed" },
  { value: "Running", label: "Running" },
  { value: "Skipped", label: "Skipped" },
];

const stagger = (i: number) => Math.min(i, 8) * 50;

function duration(ms: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)} s`;
  return `${Math.round(ms / 60000)} min`;
}

// Runs arrive newest first, so consecutive runs on the same local day share one titled group.
function byDay(runs: OpsRun[]): { key: string; label: string; runs: OpsRun[] }[] {
  const groups: { key: string; label: string; runs: OpsRun[] }[] = [];
  const yesterday = new Date(Date.now() - 864e5).toDateString();
  for (const run of runs) {
    const d = run.startedAt ? new Date(run.startedAt) : null;
    const valid = d && !Number.isNaN(d.getTime());
    const key = valid ? d.toDateString() : "none";
    const label = !valid ? "No start time" : isToday(run.startedAt) ? "Today" : key === yesterday ? "Yesterday" : fmtShortDay(run.startedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.runs.push(run);
    else groups.push({ key, label, runs: [run] });
  }
  return groups;
}

export default function RunHistoryScreen() {
  const { project } = useControl();
  const [status, setStatus] = useState("all");
  const list = useControlQuery<{ runs: OpsRun[] }>(
    project ? `/api/control/ops/projects/${project.id}/workflow-runs${status !== "all" ? `?status=${status}` : ""}` : null,
  );
  const runs = list.data?.runs ?? [];

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load runs" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!runs.length) {
    body =
      status !== "all" ? (
        <EmptyState icon="search" title={`No ${status.toLowerCase()} runs`} message="Runs with this result will show up here." actionLabel="Show all runs" onAction={() => setStatus("all")} />
      ) : (
        <EmptyState icon="clock" title="No runs yet" message="Each time a workflow fires, its run appears here." />
      );
  } else {
    body = (
      <View style={styles.stack}>
        {byDay(runs).map((group, g) => {
          const failed = group.runs.filter((r) => r.status === "Failed").length;
          return (
            <Animated.View key={group.key} entering={FadeInDown.delay(stagger(g)).springify()}>
              <ListGroup title={group.label} action={<CountBadge value={failed ? `${failed} failed` : group.runs.length} tone={failed ? "danger" : "neutral"} />}>
                {group.runs.map((r, i) => (
                  <RunRow key={r.id} run={r} divider={i < group.runs.length - 1} />
                ))}
              </ListGroup>
            </Animated.View>
          );
        })}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Run history" />}>
      <View style={styles.filters}>
        <FilterChips options={FILTERS} value={status} onChange={setStatus} />
      </View>
      {body}
    </Screen>
  );
}

// One run: its result as the tile's tone, the start time and progress in mono, and the error when it failed.
function RunRow({ run: r, divider }: { run: OpsRun; divider: boolean }) {
  const meta = RUN_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const, icon: "workflow" as const, tile: "outline" as const };
  const facts = [fmtClock(r.startedAt), r.stepsTotal ? `${r.stepsCompleted}/${r.stepsTotal} steps` : "", duration(r.durationMs)].filter(Boolean).join(" · ");
  return (
    <View
      style={[styles.row, divider && styles.divided]}
      accessible
      accessibilityLabel={[r.workflowName || "Workflow", meta.label, r.triggerLabel, facts, r.error].filter(Boolean).join(", ")}
    >
      <IconTile icon={meta.icon} size={36} tone={meta.tile} />
      <View style={styles.rowStack}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {r.workflowName || "Workflow"}
          </Text>
          <Pill label={meta.label} tone={meta.tone} variant="outline" />
        </View>
        {r.triggerLabel ? (
          <Text style={styles.trigger} numberOfLines={1}>
            {r.triggerLabel}
          </Text>
        ) : null}
        {facts ? <Text style={styles.facts}>{facts}</Text> : null}
        {r.error ? (
          <Text style={styles.error} numberOfLines={3}>
            {r.error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 22,
  },
  name: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  trigger: {
    ...type.caption,
    color: colors.textSecondary,
  },
  facts: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
  error: {
    ...type.caption,
    color: colors.danger,
    marginTop: 2,
  },
});
