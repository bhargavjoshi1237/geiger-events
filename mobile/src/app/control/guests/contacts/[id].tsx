import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListEditor } from "@/components/control/fields/ListEditor";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDateTime } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { GuestContact, GuestContactPatch } from "@/types/control_guests";

type TextKey = "name" | "email" | "phone" | "company" | "title" | "location";

const FIELDS: { key: TextKey; label: string; keyboard?: "email-address" | "phone-pad"; caps?: "none" | "words" }[] = [
  { key: "name", label: "Name", caps: "words" },
  { key: "email", label: "Email", keyboard: "email-address", caps: "none" },
  { key: "phone", label: "Phone", keyboard: "phone-pad" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "location", label: "Location" },
];

const stagger = (i: number) => Math.min(i, 8) * 50;

// "Mar 2026": short enough to sit in a readout cell.
function monthYear(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function ContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const query = useControlQuery<{ contact: GuestContact }>(`/api/control/guests/contacts/${id}`, { refetchOnFocus: false });
  const contact = query.data?.contact;

  if (contact) {
    // Keyed by the saved contact so a save re-seeds the form from the server.
    return <ContactEditor key={JSON.stringify(contact)} contact={contact} onSaved={(next) => query.setData({ contact: next })} />;
  }
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Contact" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {query.error ? (
          <EmptyState icon="circle-alert" title="Couldn't open this contact" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
        ) : (
          <View style={styles.stack}>
            <View style={styles.heroTop}>
              <Skeleton width={64} height={64} circle />
              <View style={styles.heroText}>
                <Skeleton width="70%" height={22} />
                <Skeleton width="50%" height={14} />
              </View>
            </View>
            <Skeleton height={78} radius={radius.lg} />
            <SkeletonList rows={3} variant="card" />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ContactEditor({ contact, onSaved }: { contact: GuestContact; onSaved: (next: GuestContact) => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [draft, setDraft] = useState<Required<GuestContactPatch>>({
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    title: contact.title,
    location: contact.location,
    tags: contact.tags,
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"save" | "note" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const changes: GuestContactPatch = {};
  for (const { key } of FIELDS) if (draft[key].trim() !== contact[key]) changes[key] = draft[key];

  const fieldsDirty = Object.keys(changes).length > 0;
  const tagsDirty = JSON.stringify(draft.tags) !== JSON.stringify(contact.tags);
  if (tagsDirty) changes.tags = draft.tags;
  const dirty = Object.keys(changes).length > 0;

  const call = async (kind: "save" | "note" | "delete", path: string, method: string, body?: unknown) => {
    setBusy(kind);
    const res = await controlApi<{ contact?: GuestContact; deleted?: boolean }>(path, { method, body });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      toast.error(res.error);
      return null;
    }
    successFeedback();
    return res.data;
  };

  const save = async () => {
    const data = await call("save", `/api/control/guests/contacts/${contact.id}`, "PATCH", changes);
    if (data?.contact) {
      toast.success("Contact saved.");
      onSaved(data.contact);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return toast.error("Write a note first.");
    const data = await call("note", `/api/control/guests/contacts/${contact.id}/notes`, "POST", { body: note });
    if (data?.contact) {
      setNote("");
      toast.success("Note added.");
      onSaved(data.contact);
    }
  };

  const removeNote = async (noteId: string) => {
    const data = await call("note", `/api/control/guests/contacts/${contact.id}/notes/${noteId}`, "DELETE");
    if (data?.contact) onSaved(data.contact);
  };

  const remove = async () => {
    const data = await call("delete", `/api/control/guests/contacts/${contact.id}`, "DELETE");
    if (data?.deleted) {
      setConfirmDelete(false);
      toast.success("Contact deleted.");
      router.back();
    }
  };

  const role = [contact.title, contact.company, contact.location].filter(Boolean).join(" · ");
  let step = 0;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Contact" right={<Button title="Save" size="sm" onPress={() => void save()} loading={busy === "save"} disabled={!dirty || busy !== null} />} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
            <View style={styles.heroTop}>
              <Avatar name={contact.name} email={contact.email} size={64} />
              <View style={styles.heroText}>
                <Text style={styles.name} numberOfLines={2}>
                  {contact.name || contact.email || "Unnamed"}
                </Text>
                {contact.name && contact.email ? (
                  <Text style={styles.email} numberOfLines={1}>
                    {contact.email}
                  </Text>
                ) : null}
                {role ? (
                  <Text style={styles.role} numberOfLines={2}>
                    {role}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.chips}>
              {contact.blocked ? <Pill label="Blocked" tone="danger" /> : null}
              {contact.status ? <Pill label={contact.status} tone="neutral" /> : null}
              {contact.tags.map((tag) => (
                <Pill key={tag} label={tag} tone="neutral" variant="outline" dot={false} />
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Readout
              items={[
                { label: "Notes", value: String(contact.notes.length) },
                { label: "Tags", value: String(contact.tags.length) },
                { label: "In book since", value: monthYear(contact.createdAt) },
              ]}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Details" footer={fieldsDirty ? "Unsaved changes. Tap Save to keep them." : undefined}>
              <View style={styles.panel}>
                {FIELDS.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <Input
                      value={draft[f.key]}
                      onChangeText={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                      keyboardType={f.keyboard}
                      autoCapitalize={f.caps ?? "sentences"}
                      autoCorrect={f.key !== "email"}
                    />
                  </Field>
                ))}
              </View>
            </ListGroup>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            {/* ListEditor draws its own grouped list, so the section only needs the kicker. */}
            <SectionTitle variant="kicker" action={<CountBadge value={draft.tags.length} />}>
              Tags
            </SectionTitle>
            <ListEditor value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} placeholder="Add a tag…" />
            {tagsDirty ? <Text style={styles.unsaved}>Tag changes save with the contact. Tap Save to keep them.</Text> : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Notes" action={<CountBadge value={contact.notes.length} />} footer="Only your team sees notes.">
              <View style={[styles.panel, styles.composer]}>
                <Input value={note} onChangeText={setNote} placeholder="Add a note your team can see…" multiline textAlignVertical="top" style={styles.multiline} />
                <View style={styles.composerActions}>
                  <Button title="Add note" size="sm" variant="secondary" icon="plus" onPress={() => void addNote()} loading={busy === "note"} disabled={busy !== null} />
                </View>
              </View>
              {contact.notes.length ? (
                contact.notes.map((n) => (
                  <View key={n.id} style={styles.note}>
                    <View style={styles.noteText}>
                      <Text style={styles.noteBody}>{n.body}</Text>
                      {n.createdAt ? <Text style={styles.noteMeta}>{fmtDateTime(n.createdAt)}</Text> : null}
                    </View>
                    <IconButton icon="trash-2" label="Delete note" variant="plain" size={32} iconSize={16} onPress={() => void removeNote(n.id)} />
                  </View>
                ))
              ) : (
                <Text style={styles.noNotes}>No notes yet.</Text>
              )}
            </ListGroup>
          </Animated.View>

          <Button title="Delete contact" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
        </View>
      </ScrollView>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this contact?">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>They leave the Contact Book. Their registrations and orders stay as they are.</Text>
          <View style={styles.sheetActions}>
            <Button title="Keep" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete contact" variant="destructive" onPress={() => void remove()} loading={busy === "delete"} />
          </View>
        </View>
      </Sheet>
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
  hero: {
    gap: spacing.md + 2,
    paddingTop: spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  email: {
    ...type.body,
    fontSize: 14,
    lineHeight: 19,
    color: colors.mutedForeground,
  },
  role: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  panel: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  composer: {
    gap: spacing.md,
  },
  composerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  multiline: {
    minHeight: 80,
    paddingTop: spacing.md,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceActive,
    paddingVertical: spacing.md,
  },
  noteText: {
    flex: 1,
    gap: 4,
  },
  noteBody: {
    ...type.body,
    color: colors.foreground,
  },
  noteMeta: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  unsaved: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  noNotes: {
    ...type.caption,
    color: colors.textSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceActive,
    paddingVertical: spacing.md,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetText: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
