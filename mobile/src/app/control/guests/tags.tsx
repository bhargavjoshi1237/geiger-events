import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
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
import type { GuestTag } from "@/types/control_guests";

export default function TagsScreen() {
  const router = useRouter();
  const { project } = useControl();
  const list = useControlQuery<{ tags: GuestTag[] }>(project ? `/api/control/guests/projects/${project.id}/tags` : null);
  const [selected, setSelected] = useState<GuestTag | null>(null);
  const tags = list.data?.tags ?? [];

  return (
    <Screen scroll header={<ScreenHeader title="Tags" />}>
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load tags" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={6} variant="divided" />
      ) : !tags.length ? (
        <EmptyState icon="tag" title="No tags yet" message="Tag contacts from their page in the Contact Book." />
      ) : (
        <View style={styles.group}>
          {tags.map((t, i) => (
            <ListRow
              key={t.id ?? t.name}
              leading={<IconTile icon="tag" size={34} />}
              title={t.name}
              subtitle={`${t.count.toLocaleString("en-US")} ${pluralize(t.count, "contact", "contacts")}`}
              onPress={() => setSelected(t)}
              divider={i < tags.length - 1}
            />
          ))}
        </View>
      )}
      {project ? (
        <Sheet visible={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? "Tag"}>
          {selected ? (
            <TagForm
              projectId={project.id}
              tag={selected}
              onDone={() => {
                setSelected(null);
                void list.reload();
              }}
              onViewContacts={() => {
                const name = selected.name;
                setSelected(null);
                router.push({ pathname: "/control/guests/contacts", params: { tag: name } });
              }}
            />
          ) : null}
        </Sheet>
      ) : null}
    </Screen>
  );
}

function TagForm({ projectId, tag, onDone, onViewContacts }: { projectId: string; tag: GuestTag; onDone: () => void; onViewContacts: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(tag.name);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"rename" | "delete" | null>(null);

  const send = async (kind: "rename" | "delete", body: Record<string, unknown>) => {
    setBusy(kind);
    const res = await controlApi<{ contacts: number }>(`/api/control/guests/projects/${projectId}/tags/${kind}`, { method: "POST", body });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(kind === "rename" ? `Renamed on ${res.data.contacts} ${pluralize(res.data.contacts, "contact", "contacts")}.` : "Tag removed everywhere.");
    onDone();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Name" hint="Renaming changes it on every contact that has it.">
          <Input value={name} onChangeText={setName} autoCapitalize="none" />
        </Field>
        <View style={styles.actions}>
          <Button title="See contacts" variant="ghost" icon="users" onPress={onViewContacts} />
          <Button
            title="Rename"
            onPress={() => void send("rename", { from: tag.name, to: name, catalogId: tag.id })}
            loading={busy === "rename"}
            disabled={busy !== null || !name.trim() || name.trim() === tag.name}
          />
        </View>
        {confirming ? (
          <View style={styles.confirm}>
            <Text style={styles.warning}>{`This takes "${tag.name}" off ${tag.count} ${pluralize(tag.count, "contact", "contacts")}. The contacts stay.`}</Text>
            <View style={styles.actions}>
              <Button title="Keep it" variant="ghost" onPress={() => setConfirming(false)} />
              <Button title="Delete tag" variant="destructive" onPress={() => void send("delete", { name: tag.name, catalogId: tag.id })} loading={busy === "delete"} />
            </View>
          </View>
        ) : (
          <Button title="Delete tag" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirming(true)} fullWidth />
        )}
      </View>
    </KeyboardAvoidingView>
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
  form: {
    gap: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  confirm: {
    gap: spacing.md,
  },
  warning: {
    ...type.body,
    color: colors.textSecondary,
  },
});
