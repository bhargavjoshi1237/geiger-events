import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsTemplate } from "@/types/control_ops";
import type { ControlEvent } from "@/types/portal";

export default function TemplatesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { project } = useControl();
  const list = useControlQuery<{ templates: OpsTemplate[]; canUse: boolean }>(project ? `/api/control/ops/projects/${project.id}/templates` : null);
  const [open, setOpen] = useState<OpsTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const templates = list.data?.templates ?? [];

  const use = async (template: OpsTemplate) => {
    setBusy(true);
    const res = await controlApi<{ event: ControlEvent }>(`/api/control/ops/templates/${template.id}/use`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`Created a draft from "${template.name}". Set its date and venue next.`);
    setOpen(null);
    router.push({ pathname: "/control/event/[id]", params: { id: res.data.event.id } });
  };

  return (
    <Screen scroll header={<ScreenHeader title="Templates" />}>
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load templates" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={5} variant="divided" />
      ) : !templates.length ? (
        <EmptyState icon="layers" title="No templates yet" message="Save an event's format, capacity and summary as a template on the dashboard, then start events from it here." />
      ) : (
        <View style={styles.group}>
          {templates.map((t, i) => (
            <ListRow
              key={t.id}
              leading={<IconTile icon="layers" size={34} />}
              title={t.name}
              subtitle={[t.category, `${t.uses} ${pluralize(t.uses, "use", "uses")}`, t.blueprint.type].join(" · ")}
              onPress={() => setOpen(t)}
              divider={i < templates.length - 1}
            />
          ))}
        </View>
      )}

      <Sheet visible={Boolean(open)} onClose={() => setOpen(null)} title={open?.name}>
        {open ? (
          <View style={styles.sheetBody}>
            {open.description ? <Text style={styles.body}>{open.description}</Text> : null}
            <View style={styles.facts}>
              <Fact label="Format" value={open.blueprint.type} />
              <Fact label="Capacity" value={open.blueprint.capacity ? String(open.blueprint.capacity) : "No limit"} />
              <Fact label="Visibility" value={open.blueprint.visibility} />
              <Fact label="Time zone" value={open.blueprint.timezone} />
            </View>
            {open.blueprint.summary ? <Text style={styles.caption}>{open.blueprint.summary}</Text> : null}
            {list.data?.canUse ? (
              <Button title="Create a draft event" icon="plus" onPress={() => void use(open)} loading={busy} fullWidth />
            ) : (
              <Text style={styles.caption}>Your role can see templates but not create events.</Text>
            )}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
  },
  caption: {
    ...type.caption,
    color: colors.textSecondary,
  },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  fact: {
    width: "48%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    gap: 2,
  },
  factLabel: {
    ...type.caption,
    color: colors.textSecondary,
  },
  factValue: {
    ...type.labelStrong,
    color: colors.foreground,
  },
});
