import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDate, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { RegistrationForm } from "@/types/control_guests";

const stagger = (i: number) => Math.min(i, 8) * 50;

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

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load forms" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={4} variant="divided" />;
  } else if (!forms.length) {
    body = <EmptyState icon="clipboard-list" title="No forms yet" message="Registration forms are built on the dashboard." />;
  } else {
    const published = forms.filter((f) => f.status === "Published").length;
    const questions = forms.reduce((sum, f) => sum + f.fields, 0);
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout
            items={[
              { label: "Published", value: String(published), hint: "Can be attached" },
              { label: "Drafts", value: String(forms.length - published) },
              { label: "Questions", value: String(questions), hint: "Across all forms" },
            ]}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
          <ListGroup title="Forms" footer="Switch a form on to publish it, or off to move it back to draft.">
            {forms.map((f, i) => {
              const live = f.status === "Published";
              return (
                <ListRow
                  key={f.id}
                  leading={<IconTile icon={live ? "clipboard-check" : "clipboard-list"} size={36} tone={live ? "success" : "neutral"} />}
                  title={f.name || "Untitled form"}
                  subtitle={[`${f.fields} ${pluralize(f.fields, "question", "questions")}`, live ? "published" : "draft", f.updatedAt && `updated ${fmtDate(f.updatedAt)}`].filter(Boolean).join(" · ")}
                  trailing={<Switch value={live} onValueChange={(on) => void toggle(f, on)} label={`${f.name} published`} disabled={busyId !== null} />}
                  divider={i < forms.length - 1}
                />
              );
            })}
          </ListGroup>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Registration Forms" />}>
      <Text style={styles.lede}>A published form can be attached to events. Build and edit questions on the dashboard.</Text>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.xl,
  },
});
