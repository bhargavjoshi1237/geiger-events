import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { GuestTag } from "@/types/control_guests";

const stagger = (i: number) => Math.min(i, 8) * 50;
const n = (value: number) => value.toLocaleString("en-US");

export default function TagsScreen() {
  const router = useRouter();
  const { project } = useControl();
  const list = useControlQuery<{ tags: GuestTag[] }>(project ? `/api/control/guests/projects/${project.id}/tags` : null);
  const [selected, setSelected] = useState<GuestTag | null>(null);
  const tags = list.data?.tags ?? [];

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load tags" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!tags.length) {
    body = <EmptyState icon="tag" title="No tags yet" message="Tag contacts from their page in the Contact Book." />;
  } else {
    // The server sorts by use, so the first tag is the most used.
    const top = tags[0];
    const unused = tags.filter((t) => !t.count).length;
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout
            items={[
              { label: "Tags", value: String(tags.length) },
              { label: "Most used", value: n(top.count), hint: top.name },
              { label: "Unused", value: String(unused), hint: "On no contact" },
            ]}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
          <ListGroup title="All tags" footer="Tap a tag to rename it, delete it or see who has it.">
            {tags.map((t, i) => (
              <ListRow
                key={t.id ?? t.name}
                leading={<IconTile icon="tag" size={36} />}
                title={t.name}
                subtitle={t.description || undefined}
                trailing={<CountBadge value={n(t.count)} />}
                onPress={() => setSelected(t)}
                divider={i < tags.length - 1}
              />
            ))}
          </ListGroup>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Tags" />}>
      {body}
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
        <View style={styles.head}>
          <IconTile icon="tag" size={44} />
          <View style={styles.headText}>
            <Text style={styles.headCount}>{`${n(tag.count)} ${pluralize(tag.count, "contact", "contacts")}`}</Text>
            {tag.description ? (
              <Text style={styles.headDescription} numberOfLines={2}>
                {tag.description}
              </Text>
            ) : null}
          </View>
          <Button title="See contacts" size="sm" variant="secondary" icon="users" onPress={onViewContacts} />
        </View>
        <Field label="Name" hint="Renaming changes it on every contact that has it.">
          <Input value={name} onChangeText={setName} autoCapitalize="none" />
        </Field>
        <View style={styles.actions}>
          <Button
            title="Rename tag"
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
  stack: {
    gap: spacing.xl,
  },
  form: {
    gap: spacing.lg,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headCount: {
    ...type.mono,
    color: colors.foreground,
  },
  headDescription: {
    ...type.caption,
    color: colors.textSecondary,
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
