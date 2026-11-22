import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsWorkflow } from "@/types/control_ops";

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
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load workflows" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={5} variant="divided" />
      ) : !workflows.length ? (
        <EmptyState icon="workflow" title="No workflows yet" message="Build automations — emails on purchase, tags on check-in — on the dashboard." />
      ) : (
        <View style={styles.group}>
          {workflows.map((w, i) => (
            <ListRow
              key={w.id}
              leading={<IconTile icon="workflow" size={34} tone={w.status === "Active" ? "success" : "neutral"} />}
              title={w.name}
              subtitle={[
                w.triggerLabel,
                `${w.steps} ${pluralize(w.steps, "step", "steps")}`,
                w.status === "Draft" ? "Draft" : w.lastRunAt ? `Ran ${fmtTimeAgo(w.lastRunAt)}` : "Not run yet",
              ].join(" · ")}
              trailing={
                <Switch
                  value={w.status === "Active"}
                  onValueChange={(on) => void toggle(w, on)}
                  label={`${w.name} on or off`}
                  disabled={busy === w.id}
                />
              }
              divider={i < workflows.length - 1}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.body,
    color: colors.textSecondary,
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
