import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { WorkflowTemplate } from "@/types/control_final";

type Category = WorkflowTemplate["category"];

const CATEGORY_ORDER: Category[] = ["Ticketing", "Engagement", "Operations", "Reminders"];

const CATEGORIES = [{ value: "all", label: "All" }, ...CATEGORY_ORDER.map((c) => ({ value: c, label: c }))];

const CATEGORY_ICON: Record<Category, IconName> = {
  Ticketing: "ticket",
  Engagement: "heart",
  Operations: "clipboard-list",
  Reminders: "bell",
};

const stagger = (i: number) => Math.min(i, 8) * 50;

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

  const groups = useMemo(() => {
    const known = CATEGORY_ORDER.map((c) => ({ category: c as string, items: templates.filter((t) => t.category === c) }));
    const other = templates.filter((t) => !CATEGORY_ORDER.includes(t.category));
    return [...known, { category: "Other", items: other }].filter((g) => g.items.length);
  }, [templates]);

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
    body = groups.map((group, g) => (
      <Animated.View key={group.category} entering={FadeInDown.delay(stagger(g + 1)).springify()}>
        <ListGroup title={`${group.category} · ${group.items.length}`}>
          {group.items.map((t, i) => (
            <View key={t.id} style={[styles.template, i < group.items.length - 1 && styles.divided]}>
              <IconTile icon={CATEGORY_ICON[t.category] ?? "workflow"} size={36} />
              <View style={styles.templateText}>
                <Text style={styles.name}>{t.name}</Text>
                <Text style={styles.description}>{t.description}</Text>
                <View style={styles.trigger}>
                  <Icon name="workflow" size={12} color={colors.textSecondary} />
                  <Text style={styles.triggerText} numberOfLines={2}>
                    {`When ${t.triggerLabel.charAt(0).toLowerCase()}${t.triggerLabel.slice(1)}`}
                  </Text>
                </View>
                <View style={styles.footer}>
                  <Text style={styles.steps}>{`${t.steps} ${pluralize(t.steps, "step", "steps")}`}</Text>
                  <Button title="Use template" icon="plus" size="sm" variant="secondary" onPress={() => void use(t)} loading={usingId === t.id} disabled={usingId !== null} />
                </View>
              </View>
            </View>
          ))}
        </ListGroup>
      </Animated.View>
    ));
  }

  return (
    <Screen scroll header={<ScreenHeader title="Workflow Templates" />}>
      <View style={styles.stack}>
        <Text style={styles.lede}>Start from a proven automation. Each template becomes a draft workflow you switch on from All workflows.</Text>
        {query.data?.templates.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(0)).springify()} style={styles.controls}>
            <Input leftIcon="search" value={search} onChangeText={setSearch} placeholder="Search templates…" autoCapitalize="none" />
            <FilterChips options={CATEGORIES} value={category} onChange={setCategory} />
          </Animated.View>
        ) : null}
        {body}
      </View>
      <Sheet visible={created !== null} onClose={() => setCreated(null)} title="Workflow created">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
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
  stack: {
    gap: spacing.xl,
  },
  lede: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: -spacing.sm,
  },
  controls: {
    gap: spacing.md,
  },
  template: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md + 2,
    paddingVertical: spacing.lg,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  templateText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs + 2,
  },
  name: {
    ...type.labelStrong,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  description: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs + 2,
    marginTop: 2,
  },
  triggerText: {
    ...type.captionStrong,
    flex: 1,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  steps: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetText: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
