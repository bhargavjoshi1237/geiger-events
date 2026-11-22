import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FieldEditor } from "@/components/control/fields/FieldEditor";
import { FormHeader, MetaText } from "@/components/control/forms/FormHeader";
import { FormPanel } from "@/components/control/forms/FormPanel";
import { FormScreen } from "@/components/control/forms/FormScreen";
import { SaveBar } from "@/components/control/forms/SaveBar";
import { ListSettingsForm } from "@/components/control/ListSettingsForm";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { iconOf, READ_ONLY_TYPES } from "@/lib/control_records";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";
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

const stagger = (i: number) => Math.min(i, 8) * 50;

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
  const changeCount = Object.keys(changes).length;
  const dirty = changeCount > 0;
  const fieldCount = setting.panels.reduce((n, panel) => n + panel.fields.length, 0);

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

  let step = 0;
  return (
    <FormScreen
      title={setting.title}
      footer={canEdit ? <SaveBar title="Save changes" changes={changeCount} onPress={() => void save()} loading={saving} disabled={!dirty || saving} /> : undefined}
    >
      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormHeader
          leading={<IconTile icon={iconOf(setting.icon, "settings")} size={52} />}
          title={setting.title}
          description={setting.description}
          meta={
            <>
              {!canEdit ? <Pill label="View only" tone="neutral" variant="outline" dot={false} /> : null}
              <MetaText>{`${fieldCount} ${pluralize(fieldCount, "setting", "settings")}`}</MetaText>
            </>
          }
        />
      </Animated.View>

      {!canEdit ? (
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup>
            <View style={styles.notice}>
              <IconTile icon="lock" size={32} />
              <Text style={styles.noticeText}>Your role can see these settings but not change them.</Text>
            </View>
          </ListGroup>
        </Animated.View>
      ) : null}

      <View style={styles.panels} pointerEvents={canEdit ? "auto" : "none"}>
        {setting.panels.map((panel, i) => (
          <Animated.View key={`${i}:${panel.title}`} entering={FadeInDown.delay(stagger(step++)).springify()}>
            <FormPanel title={panel.title} footer={panel.description}>
              {panel.fields.map((field) => (
                <FieldEditor
                  key={field.key}
                  field={field}
                  projectId={projectId}
                  value={draft[field.key]}
                  onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))}
                />
              ))}
            </FormPanel>
          </Animated.View>
        ))}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  panels: {
    gap: spacing.xl,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  noticeText: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    color: colors.textSecondary,
  },
});
