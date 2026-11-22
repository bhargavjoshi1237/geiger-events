import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldEditor } from "@/components/control/fields/FieldEditor";
import { ListSettingsForm } from "@/components/control/ListSettingsForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { READ_ONLY_TYPES } from "@/lib/control_records";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlSetting } from "@/types/portal";

export type SettingValues = Record<string, unknown>;

type Props = {
  setting: ControlSetting;
  values: SettingValues;
  path: string;
  projectId: string;
  canEdit?: boolean;
  onSaved: (values: SettingValues) => void;
};

// One settings page drawn from its catalog fields; list-shaped pages (FAQ, alerts…) get the item editor instead.
export function SettingsForm(props: Props) {
  if (props.setting.shape === "list") {
    const items = Array.isArray(props.values.items) ? (props.values.items as Record<string, unknown>[]) : [];
    return <ListSettingsForm {...props} items={items} onSaved={(next) => props.onSaved({ items: next })} />;
  }
  return <ObjectSettingsForm {...props} />;
}

// Save sends only what changed, and the server merges it into what's stored.
function ObjectSettingsForm({ setting, values, path, projectId, canEdit = true, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [draft, setDraft] = useState<SettingValues>(values);
  const [saving, setSaving] = useState(false);

  const changes: SettingValues = {};
  for (const panel of setting.panels) {
    for (const field of panel.fields) {
      if (READ_ONLY_TYPES.has(field.type)) continue;
      if (JSON.stringify(draft[field.key] ?? null) !== JSON.stringify(values[field.key] ?? null)) changes[field.key] = draft[field.key];
    }
  }
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    setSaving(true);
    const res = await controlApi<{ values: SettingValues }>(path, { method: "PATCH", body: { config: changes } });
    setSaving(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Settings saved.");
    onSaved(res.data.values);
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader
        title={setting.title}
        right={canEdit ? <Button title="Save" size="sm" onPress={() => void save()} loading={saving} disabled={!dirty || saving} /> : undefined}
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack} pointerEvents={canEdit ? "auto" : "none"}>
          {setting.description ? <Text style={styles.description}>{setting.description}</Text> : null}
          {!canEdit ? <Text style={styles.description}>Your role can see these settings but not change them.</Text> : null}
          {setting.panels.map((panel) => (
            <View key={panel.title} style={styles.panel}>
              <SectionTitle variant="kicker">{panel.title}</SectionTitle>
              {panel.description ? <Text style={styles.description}>{panel.description}</Text> : null}
              <View style={styles.card}>
                {panel.fields.map((field) => (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    projectId={projectId}
                    value={draft[field.key]}
                    onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  stack: {
    gap: spacing.xl,
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
});
