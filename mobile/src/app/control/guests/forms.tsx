import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { RegistrationForm } from "@/types/control_guests";

// Publish or unpublish reusable forms; building their questions stays on the dashboard.
export default function RegistrationFormsScreen() {
  const { project } = useControl();
  const toast = useToast();
  const list = useControlQuery<{ forms: RegistrationForm[] }>(project ? `/api/control/guests/projects/${project.id}/forms` : null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const forms = list.data?.forms ?? [];

  const toggle = async (form: RegistrationForm, published: boolean) => {
    setBusyId(form.id);
    const res = await controlApi<{ form: RegistrationForm }>(`/api/control/guests/forms/${form.id}`, {
      method: "PATCH",
      body: { status: published ? "Published" : "Draft" },
    });
    setBusyId(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(published ? "Form published." : "Form moved to draft.");
    list.setData((prev) => (prev ? { forms: prev.forms.map((f) => (f.id === form.id ? res.data.form : f)) } : prev));
  };

  return (
    <Screen scroll header={<ScreenHeader title="Registration Forms" />}>
      <Text style={styles.lede}>A published form can be attached to events. Build and edit questions on the dashboard.</Text>
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load forms" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={4} variant="divided" />
      ) : !forms.length ? (
        <EmptyState icon="clipboard-list" title="No forms yet" message="Registration forms are built on the dashboard." />
      ) : (
        <View style={styles.group}>
          {forms.map((f, i) => (
            <ListRow
              key={f.id}
              leading={<IconTile icon="clipboard-list" size={34} tone={f.status === "Published" ? "success" : "neutral"} />}
              title={f.name || "Untitled form"}
              subtitle={[`${f.fields} ${pluralize(f.fields, "question", "questions")}`, f.updatedAt && `updated ${fmtDate(f.updatedAt)}`].filter(Boolean).join(" · ")}
              trailing={
                <Switch
                  value={f.status === "Published"}
                  onValueChange={(on) => void toggle(f, on)}
                  label={`${f.name} published`}
                  disabled={busyId !== null}
                />
              }
              divider={i < forms.length - 1}
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
