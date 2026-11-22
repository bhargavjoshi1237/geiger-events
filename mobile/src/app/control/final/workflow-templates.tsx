import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import type { Tone } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { WorkflowTemplate } from "@/types/control_final";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "Ticketing", label: "Ticketing" },
  { value: "Engagement", label: "Engagement" },
  { value: "Operations", label: "Operations" },
  { value: "Reminders", label: "Reminders" },
];

const CATEGORY_TONE: Record<WorkflowTemplate["category"], Tone> = {
  Ticketing: "info",
  Engagement: "success",
  Operations: "neutral",
  Reminders: "warning",
};

// Start from a proven automation: a template becomes a Draft workflow; its steps are tuned in the dashboard's builder.
export default function WorkflowTemplatesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { project } = useControl();
  const path = project ? `/api/control/final/projects/${project.id}/workflow-templates` : null;
  const query = useControlQuery<{ templates: WorkflowTemplate[] }>(path, { refetchOnFocus: false });
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [usingId, setUsingId] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string } | null>(null);

  const templates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data?.templates ?? []).filter(
      (t) => (category === "all" || t.category === category) && (!q || `${t.name} ${t.description} ${t.triggerLabel}`.toLowerCase().includes(q)),
    );
  }, [query.data, category, search]);

  const use = async (template: WorkflowTemplate) => {
    if (!path || usingId) return;
    setUsingId(template.id);
    const res = await controlApi<{ workflow: { id: string; name: string; status: string } }>(path, { method: "POST", body: { templateId: template.id } });
    setUsingId(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    setCreated({ name: res.data.workflow.name });
  };

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in More first." />;
  } else if (query.error && !query.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load templates" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />;
  } else if (!query.data) {
    body = <SkeletonList rows={4} variant="card" />;
  } else if (!templates.length) {
    body = (
      <EmptyState
        icon="search"
        title="No templates match"
        message="Try clearing the search or picking another category."
        actionLabel="Show all"
        onAction={() => {
          setSearch("");
          setCategory("all");
        }}
      />
    );
  } else {
    body = (
      <View style={styles.list}>
        {templates.map((t) => (
          <View key={t.id} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.name}>{t.name}</Text>
              <Pill label={t.category} tone={CATEGORY_TONE[t.category] ?? "neutral"} variant="outline" />
            </View>
            <Text style={styles.description}>{t.description}</Text>
            <Text style={styles.meta}>{`When: ${t.triggerLabel} · ${t.steps} ${pluralize(t.steps, "step", "steps")}`}</Text>
            <Button title="Use template" icon="workflow" variant="secondary" onPress={() => void use(t)} loading={usingId === t.id} disabled={usingId !== null} fullWidth />
          </View>
        ))}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Workflow Templates" />}>
      {query.data?.templates.length ? (
        <View style={styles.controls}>
          <Input leftIcon="search" value={search} onChangeText={setSearch} placeholder="Search templates…" autoCapitalize="none" />
          <FilterChips options={CATEGORIES} value={category} onChange={setCategory} />
        </View>
      ) : null}
      {body}
      <Sheet visible={created !== null} onClose={() => setCreated(null)} title="Workflow created">
        <View style={styles.sheetBody}>
          <Text style={styles.description}>
            {`"${created?.name ?? ""}" was added as a Draft. Switch it on from All workflows; adjust its steps in the dashboard's builder.`}
          </Text>
          <View style={styles.sheetActions}>
            <Button title="Done" variant="ghost" onPress={() => setCreated(null)} />
            <Button
              title="Open workflows"
              onPress={() => {
                setCreated(null);
                router.push("/control/ops/workflows");
              }}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: {
    ...type.label,
    fontSize: 15,
    flex: 1,
    color: colors.foreground,
  },
  description: {
    ...type.body,
    color: colors.textSecondary,
  },
  meta: {
    ...type.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
