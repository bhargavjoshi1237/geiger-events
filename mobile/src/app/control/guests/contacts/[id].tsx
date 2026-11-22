import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListEditor } from "@/components/control/fields/ListEditor";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
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
          <SkeletonList rows={5} variant="card" />
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

  if (JSON.stringify(draft.tags) !== JSON.stringify(contact.tags)) changes.tags = draft.tags;
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

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader
        title={contact.name || "Contact"}
        subtitle={contact.email || undefined}
        right={<Button title="Save" size="sm" onPress={() => void save()} loading={busy === "save"} disabled={!dirty || busy !== null} />}
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          <View style={styles.panel}>
            <SectionTitle variant="kicker">Details</SectionTitle>
            <View style={styles.card}>
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
          </View>

          <View style={styles.panel}>
            <SectionTitle variant="kicker">Tags</SectionTitle>
            <View style={styles.card}>
              <ListEditor value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} placeholder="Add a tag…" />
            </View>
          </View>

          <View style={styles.panel}>
            <SectionTitle variant="kicker">Notes</SectionTitle>
            <View style={styles.card}>
              <Input value={note} onChangeText={setNote} placeholder="Add a note your team can see…" multiline textAlignVertical="top" style={styles.multiline} />
              <Button title="Add note" size="sm" variant="secondary" icon="plus" onPress={() => void addNote()} loading={busy === "note"} disabled={busy !== null} />
              {contact.notes.length ? (
                contact.notes.map((n) => (
                  <View key={n.id} style={styles.note}>
                    <View style={styles.noteText}>
                      <Text style={styles.noteBody}>{n.body}</Text>
                      <Text style={styles.noteMeta}>{fmtDateTime(n.createdAt)}</Text>
                    </View>
                    <IconButton icon="trash-2" label="Delete note" variant="plain" size={32} iconSize={16} onPress={() => void removeNote(n.id)} />
                  </View>
                ))
              ) : (
                <Text style={styles.noteMeta}>No notes yet.</Text>
              )}
            </View>
          </View>

          <Button title="Delete contact" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
        </View>
      </ScrollView>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this contact?">
        <View style={styles.sheetBody}>
          <Text style={styles.noteMeta}>They leave the Contact Book. Their registrations and orders stay as they are.</Text>
          <View style={styles.sheetActions}>
            <Button title="Keep" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete" variant="destructive" onPress={() => void remove()} loading={busy === "delete"} />
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
  panel: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.lg,
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
    paddingTop: spacing.md,
  },
  noteText: {
    flex: 1,
    gap: 2,
  },
  noteBody: {
    ...type.body,
    color: colors.foreground,
  },
  noteMeta: {
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
