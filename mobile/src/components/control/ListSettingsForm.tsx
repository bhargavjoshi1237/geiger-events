import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldEditor } from "@/components/control/fields/FieldEditor";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { displayValue, READ_ONLY_TYPES } from "@/lib/control_records";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlSetting } from "@/types/portal";

type Item = Record<string, unknown>;

type Props = {
  setting: ControlSetting;
  items: Item[];
  path: string;
  projectId: string;
  canEdit?: boolean;
  onSaved: (items: Item[]) => void;
};

// A list section (FAQ, alerts, highlights): items open in a sheet; Save sends the whole list, each item keeping its id or original index.
export function ListSettingsForm({ setting, items: saved, path, projectId, canEdit = true, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>(saved);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const fields = setting.panels.flatMap((p) => p.fields);
  const titleField = fields.find((f) => f.key === setting.itemTitle) ?? fields[0];
  const noun = (setting.itemLabel ?? "item").toLowerCase();
  const dirty = JSON.stringify(items) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    // Read-only keys are the dashboard's to change, so they aren't sent back.
    const body = items.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => !READ_ONLY_TYPES.has(fields.find((f) => f.key === key)?.type ?? ""))));
    const res = await controlApi<{ values: { items: Item[] } }>(path, { method: "PATCH", body: { items: body } });
    setSaving(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Saved.");
    onSaved(res.data.values.items);
  };

  const move = (from: number, to: number) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader
        title={setting.title}
        right={canEdit ? <Button title="Save" size="sm" onPress={() => void save()} loading={saving} disabled={!dirty || saving} /> : undefined}
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        {setting.description ? <Text style={styles.description}>{setting.description}</Text> : null}
        {!items.length ? (
          <EmptyState
            icon="list-checks"
            title={`No ${noun}s yet`}
            message={canEdit ? `Add the first ${noun}, then save.` : "Nothing has been added yet."}
            actionLabel={canEdit ? `Add ${noun}` : undefined}
            onAction={canEdit ? () => {
              setItems((list) => [...list, {}]);
              setEditing(items.length);
            } : undefined}
          />
        ) : (
          <View style={styles.group}>
            {items.map((item, i) => (
              <ListRow
                key={`${String(item.id ?? item._i ?? "new")}-${i}`}
                title={displayValue(titleField, item[titleField.key]) || `Untitled ${noun}`}
                onPress={canEdit ? () => setEditing(i) : undefined}
                trailing={
                  canEdit ? (
                    <View style={styles.moves}>
                      <IconButton icon="arrow-up" label="Move up" variant="plain" size={32} iconSize={16} onPress={() => i > 0 && move(i, i - 1)} />
                      <IconButton icon="arrow-down" label="Move down" variant="plain" size={32} iconSize={16} onPress={() => i < items.length - 1 && move(i, i + 1)} />
                    </View>
                  ) : undefined
                }
                divider={i < items.length - 1}
              />
            ))}
          </View>
        )}
        {canEdit && items.length ? (
          <View style={styles.add}>
            <Button
              title={`Add ${noun}`}
              icon="plus"
              variant="secondary"
              onPress={() => {
                setItems((list) => [...list, {}]);
                setEditing(items.length);
              }}
              fullWidth
            />
          </View>
        ) : null}
      </ScrollView>

      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title={setting.itemLabel ?? "Item"}>
        {editing !== null && items[editing] ? (
          <ItemEditor
            item={items[editing]}
            setting={setting}
            projectId={projectId}
            onDone={(next) => {
              setItems((list) => list.map((it, i) => (i === editing ? next : it)));
              setEditing(null);
            }}
            onRemove={() => {
              setItems((list) => list.filter((_, i) => i !== editing));
              setEditing(null);
            }}
          />
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function ItemEditor({ item, setting, projectId, onDone, onRemove }: { item: Item; setting: ControlSetting; projectId: string; onDone: (next: Item) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState<Item>(item);
  return (
    <View style={styles.sheetBody}>
      {setting.panels.flatMap((p) => p.fields).map((field) => (
        <FieldEditor key={field.key} field={field} projectId={projectId} value={draft[field.key]} onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))} />
      ))}
      <View style={styles.sheetActions}>
        <Button title="Remove" variant="destructiveGhost" icon="trash-2" onPress={onRemove} />
        <Button title="Done" onPress={() => onDone(draft)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  description: {
    ...type.caption,
    color: colors.textSecondary,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  moves: {
    flexDirection: "row",
  },
  add: {
    marginTop: spacing.xs,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
});
