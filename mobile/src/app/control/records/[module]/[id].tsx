import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldEditor } from "@/components/control/fields/FieldEditor";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { appliesTo, changesFrom, draftFrom, draftValue, statusOf, withValue, type Draft } from "@/lib/control_records";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlCatalog } from "@/lib/use_control_catalog";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlModule, ControlRecord } from "@/types/portal";

export default function RecordScreen() {
  const { module: moduleId, id } = useLocalSearchParams<{ module: string; id: string }>();
  const catalog = useControlCatalog();
  const mod = catalog.findModule(moduleId);
  const query = useControlQuery<{ record: ControlRecord }>(mod ? `/api/control/records/${mod.id}/${id}` : null, { refetchOnFocus: false });
  const record = query.data?.record ?? null;

  if (catalog.error && !catalog.data) {
    return <Frame title="Manage" body={<EmptyState icon="circle-alert" title="Couldn't load this area" message={catalog.error} actionLabel="Try again" onAction={() => void catalog.reload()} />} />;
  }
  if (catalog.data && !mod) {
    return <Frame title="Manage" body={<EmptyState icon="shield" title="Not available" message="Your role can't open this area in this project." />} />;
  }
  if (query.error && !record) {
    return <Frame title={mod?.singular ?? "Manage"} body={<EmptyState icon="circle-alert" title="Couldn't open this" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />} />;
  }
  if (!mod || !record || !catalog.projectId) return <Frame title={mod?.singular ?? "Manage"} body={<SkeletonList rows={5} variant="card" />} />;

  // Keyed by record id so a reload after saving re-seeds the form from the server.
  return <Editor key={`${record.id}:${JSON.stringify(record)}`} module={mod} record={record} projectId={catalog.projectId} onSaved={(next) => query.setData({ record: next })} />;
}

function Frame({ title, body, right }: { title: string; body: React.ReactNode; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title={title} right={right} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </View>
  );
}

function Editor({ module, record, projectId, onSaved }: { module: ControlModule; record: ControlRecord; projectId: string; onSaved: (next: ControlRecord) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(module, record));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const changes = changesFrom(module, record, draft);
  const dirty = Object.keys(changes).length > 0;
  const pill = statusOf(module, record);

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    const res = await controlApi<{ record: ControlRecord }>(`/api/control/records/${module.id}/${record.id}`, { method: "PATCH", body: changes });
    setSaving(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Saved.");
    onSaved(res.data.record);
  };

  const remove = async () => {
    setDeleting(true);
    const res = await controlApi<{ deleted: boolean }>(`/api/control/records/${module.id}/${record.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    setConfirmDelete(false);
    successFeedback();
    toast.success(`${module.singular} deleted.`);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Frame
        title={module.singular}
        right={<Button title="Save" size="sm" onPress={() => void save()} loading={saving} disabled={!dirty || saving} />}
        body={
          <View style={styles.stack}>
            <View style={styles.head}>
              <Text style={styles.name} numberOfLines={2}>
                {record.name}
              </Text>
              {pill ? <Pill label={pill.label} tone={pill.tone} /> : null}
            </View>
            {module.panels.map((panel) => ({ ...panel, fields: panel.fields.filter((f) => appliesTo(f, record.kind)) })).filter((panel) => panel.fields.length).map((panel) => (
              <View key={panel.title} style={styles.panel}>
                <SectionTitle variant="kicker">{panel.title}</SectionTitle>
                {panel.description ? <Text style={styles.description}>{panel.description}</Text> : null}
                <View style={styles.card}>
                  {panel.fields.map((field) => (
                    <FieldEditor
                      key={`${field.scope}:${field.key}`}
                      field={field}
                      statuses={module.statuses}
                      projectId={projectId}
                      value={draftValue(draft, field)}
                      onChange={(v) => setDraft((d) => withValue(d, field, v))}
                    />
                  ))}
                </View>
              </View>
            ))}
            <Button title={`Delete ${module.singular.toLowerCase()}`} icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
          </View>
        }
      />
      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${record.name}?`}>
        <View style={styles.sheetBody}>
          <Text style={styles.description}>{"It disappears from the dashboard and the app. This can't be undone here."}</Text>
          <View style={styles.sheetActions}>
            <Button title="Keep it" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete" variant="destructive" onPress={() => void remove()} loading={deleting} />
          </View>
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.xl,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: {
    ...type.title,
    flex: 1,
    color: colors.foreground,
  },
  panel: {
    gap: spacing.sm,
  },
  description: {
    ...type.caption,
    color: colors.textSecondary,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.lg,
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
