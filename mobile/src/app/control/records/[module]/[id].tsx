import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CoverWash } from "@/components/control/CoverWash";
import { FieldEditor } from "@/components/control/fields/FieldEditor";
import { FormPanel } from "@/components/control/forms/FormPanel";
import { FormScreen } from "@/components/control/forms/FormScreen";
import { FormSkeleton } from "@/components/control/forms/FormSkeleton";
import { SaveBar } from "@/components/control/forms/SaveBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { appliesTo, changesFrom, draftFrom, draftValue, iconOf, statusOf, summaryLine, withValue, type Draft } from "@/lib/control_records";
import { fmtDate, fmtDateTime } from "@/lib/format";
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
  if (!mod || !record || !catalog.projectId) return <Frame title={mod?.singular ?? "Manage"} body={<FormSkeleton panels={2} />} />;

  // Keyed by record id so a reload after saving re-seeds the form from the server.
  return <Editor key={`${record.id}:${JSON.stringify(record)}`} module={mod} record={record} projectId={catalog.projectId} onSaved={(next) => query.setData({ record: next })} />;
}

function Frame({ title, body, backdrop, footer }: { title: string; body: React.ReactNode; backdrop?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <FormScreen title={title} backdrop={backdrop} footer={footer}>
      {body}
    </FormScreen>
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
  const meta = [summaryLine(module, record), record.startsAt ? fmtDateTime(record.startsAt) : record.createdAt ? `Added ${fmtDate(record.createdAt)}` : ""].filter(Boolean).join(" · ");

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
    <>
      <Frame
        title={module.singular}
        backdrop={record.coverUrl ? <CoverWash uri={record.coverUrl} height={300} /> : undefined}
        footer={<SaveBar title="Save changes" icon="check" onPress={() => void save()} loading={saving} disabled={!dirty || saving} changes={Object.keys(changes).length} />}
        body={
          <View style={styles.stack}>
            <View style={styles.head}>
              {record.coverUrl ? (
                <Image source={{ uri: record.coverUrl }} contentFit="cover" transition={150} style={styles.thumb} />
              ) : (
                <IconTile icon={iconOf(module.icon)} size={52} />
              )}
              <View style={styles.headText}>
                <Text style={styles.name} numberOfLines={3}>
                  {record.name}
                </Text>
                <View style={styles.metaRow}>
                  {pill ? <Pill label={pill.label} tone={pill.tone} /> : null}
                  {meta ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {meta}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
            {module.panels.map((panel) => ({ ...panel, fields: panel.fields.filter((f) => appliesTo(f, record.kind)) })).filter((panel) => panel.fields.length).map((panel) => (
              <FormPanel key={panel.title} title={panel.title} footer={panel.description}>
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
              </FormPanel>
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
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  meta: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  description: {
    ...type.caption,
    color: colors.textSecondary,
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
