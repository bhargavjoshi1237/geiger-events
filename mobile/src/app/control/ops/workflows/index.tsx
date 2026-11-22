import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { OpsWorkflow } from "@/types/control_ops";

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function WorkflowsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { project } = useControl();
  const list = useControlQuery<{ workflows: OpsWorkflow[] }>(project ? `/api/control/ops/projects/${project.id}/workflows` : null);
  const [busy, setBusy] = useState<string | null>(null);
  const workflows = list.data?.workflows ?? [];

  const toggle = async (workflow: OpsWorkflow, on: boolean) => {
    setBusy(workflow.id);
    const res = await controlApi<{ workflow: OpsWorkflow }>(`/api/control/ops/workflows/${workflow.id}`, {
      method: "PATCH",
      body: { status: on ? "Active" : "Paused" },
    });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(on ? `"${workflow.name}" is on.` : `"${workflow.name}" is paused.`);
    list.setData((prev) => (prev ? { workflows: prev.workflows.map((w) => (w.id === workflow.id ? res.data.workflow : w)) } : prev));
  };

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load workflows" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={5} variant="divided" />;
  } else if (!workflows.length) {
    body = <EmptyState icon="workflow" title="No workflows yet" message="Build automations — emails on purchase, tags on check-in — on the dashboard." />;
  } else {
    const active = workflows.filter((w) => w.status === "Active").length;
    const paused = workflows.filter((w) => w.status === "Paused").length;
    const drafts = workflows.filter((w) => w.status === "Draft").length;
    const runs = workflows.reduce((n, w) => n + w.runCount, 0);
    let step = 0;
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Readout
            lead={{ label: "Running", value: String(active), hint: `of ${workflows.length}`, tone: active ? "success" : "neutral" }}
            items={[
              { label: "Paused", value: String(paused) },
              { label: "Drafts", value: String(drafts) },
              { label: "Runs", value: runs.toLocaleString("en-US") },
            ]}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Automations">
            {workflows.map((w, i) => (
              <WorkflowRow key={w.id} workflow={w} busy={busy === w.id} onToggle={(on) => void toggle(w, on)} divider={i < workflows.length - 1} />
            ))}
          </ListGroup>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup>
            <ListRow leading={<IconTile icon="clock" size={36} />} title="Run history" subtitle="Every run, with its result and timing" onPress={() => router.push("/control/ops/workflows/runs")} divider={false} />
          </ListGroup>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Workflows"
          right={<IconButton icon="clock" label="Run history" variant="plain" onPress={() => router.push("/control/ops/workflows/runs")} />}
        />
      }
    >
      <Text style={styles.lede}>Switch automations on or off. Steps and triggers are built on the dashboard&apos;s canvas.</Text>
      {body}
    </Screen>
  );
}

// An automation that's running lights green; its trigger, steps and last run read underneath in mono.
function WorkflowRow({ workflow: w, busy, onToggle, divider }: { workflow: OpsWorkflow; busy: boolean; onToggle: (on: boolean) => void; divider: boolean }) {
  const on = w.status === "Active";
  const ran = w.status === "Draft" ? "" : w.lastRunAt ? `ran ${fmtTimeAgo(w.lastRunAt)}` : "not run yet";
  const facts = [`${w.steps} ${pluralize(w.steps, "step", "steps")}`, `${w.runCount.toLocaleString("en-US")} ${pluralize(w.runCount, "run", "runs")}`, ran].filter(Boolean).join(" · ");
  return (
    <View style={[styles.row, divider && styles.divided]}>
      <IconTile icon="workflow" size={36} tone={on ? "success" : "neutral"} />
      <View style={styles.rowStack}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {w.name}
          </Text>
          {w.status === "Draft" ? <Pill label="Draft" tone="neutral" variant="outline" dot={false} /> : null}
        </View>
        <Text style={styles.trigger} numberOfLines={1}>
          {w.triggerLabel}
        </Text>
        <Text style={styles.facts} numberOfLines={1}>
          {facts}
        </Text>
      </View>
      <Switch value={on} onValueChange={onToggle} label={`${w.name} on or off`} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
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
  },
  name: {
    ...type.bodyStrong,
    flexShrink: 1,
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
});
