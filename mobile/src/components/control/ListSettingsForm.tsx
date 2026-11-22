import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FieldEditor } from "@/components/control/fields/FieldEditor";
import { FormHeader, MetaText } from "@/components/control/forms/FormHeader";
import { FormPanel } from "@/components/control/forms/FormPanel";
import { FormScreen } from "@/components/control/forms/FormScreen";
import { SaveBar } from "@/components/control/forms/SaveBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { displayValue, iconOf, READ_ONLY_TYPES } from "@/lib/control_records";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlField, ControlSetting } from "@/types/portal";

type Item = Record<string, unknown>;

type Props = {
  setting: ControlSetting;
  items: Item[];
  path: string;
  projectId: string;
  canEdit?: boolean;
  onSaved: (items: Item[]) => void;
};

const stagger = (i: number) => Math.min(i, 8) * 50;

// The first other field with something in it, as the row's second line (an FAQ's answer, a highlight's detail).
function detailOf(fields: ControlField[], titleKey: string, item: Item): string | undefined {
  for (const field of fields) {
    if (field.key === titleKey || field.type === "switch" || field.type === "image" || READ_ONLY_TYPES.has(field.type)) continue;
    const text = displayValue(field, item[field.key]);
    if (text) return text;
  }
  return undefined;
}

// A list section (FAQ, alerts, highlights): items open in a sheet; Save sends the whole list, each item keeping its id or original index.
export function ListSettingsForm({ setting, items: saved, path, projectId, canEdit = true, onSaved }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>(saved);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const fields = setting.panels.flatMap((p) => p.fields);
  const titleField = fields.find((f) => f.key === setting.itemTitle) ?? fields[0];
  const noun = (setting.itemLabel ?? "item").toLowerCase();
  const nouns = `${noun}s`;
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

  const addItem = () => {
    setItems((list) => [...list, {}]);
    setEditing(items.length);
  };

  let step = 0;
  return (
    <>
      <FormScreen
        title={setting.title}
        footer={canEdit ? <SaveBar title="Save changes" changes={dirty} onPress={() => void save()} loading={saving} disabled={!dirty || saving} /> : undefined}
      >
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <FormHeader
            leading={<IconTile icon={iconOf(setting.icon, "list-checks")} size={52} />}
            title={setting.title}
            description={setting.description}
            meta={
              <>
                {!canEdit ? <Pill label="View only" tone="neutral" variant="outline" dot={false} /> : null}
                <MetaText>{`${items.length} ${items.length === 1 ? noun : nouns}`}</MetaText>
              </>
            }
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          {!items.length ? (
            <EmptyState
              icon="list-checks"
              title={`No ${nouns} yet`}
              message={canEdit ? `Add the first ${noun}, then save.` : "Nothing has been added yet."}
              actionLabel={canEdit ? `Add ${noun}` : undefined}
              onAction={canEdit ? addItem : undefined}
            />
          ) : (
            <ListGroup title="In page order" footer={canEdit ? `Tap a ${noun} to edit it; the arrows move it up or down the page.` : undefined}>
              {items.map((item, i) => (
                <ListRow
                  key={`${String(item.id ?? item._i ?? "new")}-${i}`}
                  leading={<Text style={styles.index}>{String(i + 1).padStart(2, "0")}</Text>}
                  title={displayValue(titleField, item[titleField.key]) || `Untitled ${noun}`}
                  subtitle={detailOf(fields, titleField.key, item)}
                  onPress={canEdit ? () => setEditing(i) : undefined}
                  trailing={
                    canEdit ? (
                      <View style={styles.moves}>
                        {i > 0 ? (
                          <IconButton icon="arrow-up" label={`Move ${noun} ${i + 1} up`} variant="outline" shape="square" size={32} iconSize={15} onPress={() => move(i, i - 1)} />
                        ) : (
                          <View style={styles.moveGap} />
                        )}
                        {i < items.length - 1 ? (
                          <IconButton icon="arrow-down" label={`Move ${noun} ${i + 1} down`} variant="outline" shape="square" size={32} iconSize={15} onPress={() => move(i, i + 1)} />
                        ) : (
                          <View style={styles.moveGap} />
                        )}
                      </View>
                    ) : undefined
                  }
                  divider={canEdit || i < items.length - 1}
                />
              ))}
              {canEdit ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${noun}`}
                  onPress={() => {
                    tapFeedback();
                    addItem();
                  }}
                  style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
                >
                  <View style={styles.addGlyph}>
                    <Icon name="plus" size={15} color={colors.foreground} />
                  </View>
                  <Text style={styles.addLabel}>{`Add ${noun}`}</Text>
                </Pressable>
              ) : null}
            </ListGroup>
          )}
        </Animated.View>
      </FormScreen>

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
    </>
  );
}

function ItemEditor({ item, setting, projectId, onDone, onRemove }: { item: Item; setting: ControlSetting; projectId: string; onDone: (next: Item) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState<Item>(item);
  const noun = (setting.itemLabel ?? "item").toLowerCase();
  return (
    <View style={styles.sheetBody}>
      <FormPanel>
        {setting.panels.flatMap((p) => p.fields).map((field) => (
          <FieldEditor key={field.key} field={field} projectId={projectId} value={draft[field.key]} onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))} />
        ))}
      </FormPanel>
      <Text style={styles.sheetNote}>{`Done keeps this ${noun} in the list; the page only changes when you tap Save changes.`}</Text>
      <View style={styles.sheetActions}>
        <Button title="Remove" variant="destructiveGhost" icon="trash-2" onPress={onRemove} />
        <Button title="Done" icon="check" onPress={() => onDone(draft)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  index: {
    ...type.monoSmall,
    width: 22,
    color: colors.textTertiary,
  },
  moves: {
    flexDirection: "row",
    gap: spacing.xs + 2,
  },
  moveGap: {
    width: 32,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  addGlyph: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
  },
  addLabel: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetNote: {
    ...type.caption,
    color: colors.textTertiary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
});
