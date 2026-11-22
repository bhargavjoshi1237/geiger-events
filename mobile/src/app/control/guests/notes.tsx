import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo } from "@/lib/format";
import { errorFeedback, selectionFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { GuestContact, GuestFeedNote } from "@/types/control_guests";

export default function NotesScreen() {
  const router = useRouter();
  const { project } = useControl();
  const feed = useControlQuery<{ notes: GuestFeedNote[] }>(project ? `/api/control/guests/projects/${project.id}/notes` : null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const notes = feed.data?.notes ?? [];
  const q = query.trim().toLowerCase();
  const shown = q ? notes.filter((n) => `${n.body} ${n.contactName} ${n.contactEmail}`.toLowerCase().includes(q)) : notes;

  let body: React.ReactNode;
  if (feed.error && !feed.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load notes" message={feed.error} actionLabel="Try again" onAction={() => void feed.reload()} />;
  } else if (!feed.data) {
    body = <SkeletonList rows={6} variant="card" />;
  } else if (!notes.length) {
    body = <EmptyState icon="file-text" title="No notes yet" message="Notes your team leaves on contacts show up here." actionLabel="Add a note" onAction={() => setAdding(true)} />;
  } else if (!shown.length) {
    body = <EmptyState icon="search" title="No matching notes" message="Try another word or name." actionLabel="Clear search" onAction={() => setQuery("")} />;
  } else {
    body = (
      <View style={styles.stack}>
        {shown.map((n) => (
          <Pressable
            key={`${n.contactId}-${n.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Note on ${n.contactName || n.contactEmail}`}
            onPress={() => router.push({ pathname: "/control/guests/contacts/[id]", params: { id: n.contactId } })}
            style={({ pressed }) => [styles.note, pressed && styles.pressed]}
          >
            <Text style={styles.body}>{n.body}</Text>
            <Text style={styles.meta}>{[n.contactName || n.contactEmail, fmtTimeAgo(n.createdAt)].filter(Boolean).join(" · ")}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={<ScreenHeader title="Notes" right={project ? <IconButton icon="plus" label="Add a note" variant="plain" onPress={() => setAdding(true)} /> : undefined} />}
    >
      {notes.length ? (
        <View style={styles.search}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search notes…" autoCapitalize="none" />
        </View>
      ) : null}
      {body}
      {project ? (
        <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a note">
          <AddNoteForm
            projectId={project.id}
            onClose={() => setAdding(false)}
            onAdded={() => {
              setAdding(false);
              void feed.reload();
            }}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

// Pick the contact first, then write; notes always belong to someone in the Contact Book.
function AddNoteForm({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [contact, setContact] = useState<GuestContact | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useControlQuery<{ contacts: GuestContact[] }>(
    !contact && term ? `/api/control/guests/projects/${projectId}/contacts?q=${encodeURIComponent(term)}` : null,
    { refetchOnFocus: false },
  );

  const save = async () => {
    if (!contact) return;
    if (!text.trim()) return toast.error("Write a note first.");
    setBusy(true);
    const res = await controlApi<{ contact: GuestContact }>(`/api/control/guests/contacts/${contact.id}/notes`, { method: "POST", body: { body: text } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Note added.");
    onAdded();
  };

  if (!contact) {
    return (
      <View style={styles.form}>
        <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Find a contact…" autoCapitalize="none" autoFocus />
        {term && results.loading ? (
          <SkeletonList rows={3} variant="divided" />
        ) : term ? (
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {(results.data?.contacts ?? []).slice(0, 30).map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={c.name || c.email}
                onPress={() => {
                  selectionFeedback();
                  setContact(c);
                }}
                style={({ pressed }) => [styles.result, pressed && styles.pressed]}
              >
                <Avatar name={c.name} email={c.email} size={32} />
                <View style={styles.resultText}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {c.name || c.email}
                  </Text>
                  {c.email ? <Text style={styles.meta}>{c.email}</Text> : null}
                </View>
                <Icon name="chevron-right" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
            {results.data && !results.data.contacts.length ? <Text style={styles.meta}>Nobody matches that.</Text> : null}
          </ScrollView>
        ) : (
          <Text style={styles.meta}>Search by name, email or company.</Text>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <View style={styles.result}>
          <Avatar name={contact.name} email={contact.email} size={32} />
          <View style={styles.resultText}>
            <Text style={styles.resultName}>{contact.name || contact.email}</Text>
            {contact.email ? <Text style={styles.meta}>{contact.email}</Text> : null}
          </View>
          <Button title="Change" size="sm" variant="ghost" onPress={() => setContact(null)} />
        </View>
        <Field label="Note">
          <Input value={text} onChangeText={setText} placeholder="What should the team know?" multiline textAlignVertical="top" style={styles.multiline} autoFocus />
        </Field>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Add note" onPress={() => void save()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.sm,
  },
  note: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    ...type.body,
    color: colors.foreground,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.lg,
  },
  results: {
    maxHeight: 320,
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  resultText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resultName: {
    ...type.label,
    color: colors.foreground,
  },
  multiline: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
