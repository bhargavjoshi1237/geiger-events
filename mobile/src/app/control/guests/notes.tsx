import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ContactRow } from "@/components/control/guests/ContactRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtClock, fmtDate, fmtShortDay, isToday, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { GuestContact, GuestFeedNote } from "@/types/control_guests";

const stagger = (i: number) => Math.min(i, 8) * 50;

// The day heading a note files under: Today, Yesterday, a weekday date this year, a full date before that.
function dayOf(d: string | null): string {
  const date = d ? new Date(d) : null;
  if (!date || Number.isNaN(date.getTime())) return "Undated";
  if (isToday(d)) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.getFullYear() === new Date().getFullYear() ? fmtShortDay(d) : fmtDate(d);
}

// The feed arrives newest first, so consecutive notes on the same day share a heading.
function byDay(notes: GuestFeedNote[]): { day: string; items: GuestFeedNote[] }[] {
  const groups: { day: string; items: GuestFeedNote[] }[] = [];
  for (const note of notes) {
    const day = dayOf(note.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(note);
    else groups.push({ day, items: [note] });
  }
  return groups;
}

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
    const days = byDay(shown);
    body = (
      <View style={styles.stack}>
        <Text style={styles.total}>{`${shown.length} ${pluralize(shown.length, "note", "notes")}${q ? " found" : ""}`}</Text>
        {days.map((group, g) => (
          <Animated.View key={`${group.day}-${g}`} entering={FadeInDown.delay(stagger(g)).springify()}>
            <ListGroup title={group.day} footer={g === days.length - 1 ? "Tap a note to open the contact it's on." : undefined}>
              {group.items.map((n, i) => (
                <NoteRow
                  key={`${n.contactId}-${n.id}`}
                  note={n}
                  onPress={() => router.push({ pathname: "/control/guests/contacts/[id]", params: { id: n.contactId } })}
                  divider={i < group.items.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
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

// A note as a line in the feed: who it's on, the mono time it was left, then the note in full.
function NoteRow({ note, onPress, divider }: { note: GuestFeedNote; onPress: () => void; divider: boolean }) {
  const who = note.contactName || note.contactEmail || "Contact";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Note on ${who}. Open contact`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.note, divider && styles.divided, pressed && styles.pressed]}
    >
      <Avatar name={note.contactName} email={note.contactEmail} size={32} />
      <View style={styles.noteStack}>
        <View style={styles.noteHead}>
          <Text style={styles.noteWho} numberOfLines={1}>
            {who}
          </Text>
          {note.createdAt ? <Text style={styles.noteTime}>{fmtClock(note.createdAt)}</Text> : null}
        </View>
        <Text style={styles.noteBody}>{note.body}</Text>
      </View>
    </Pressable>
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
    const found = (results.data?.contacts ?? []).slice(0, 30);
    return (
      <View style={styles.form}>
        <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Find a contact…" autoCapitalize="none" autoFocus />
        {term && results.loading ? (
          <SkeletonList rows={3} variant="divided" />
        ) : term && results.data && !found.length ? (
          <Text style={styles.hint}>Nobody matches that. Try a name, email or company.</Text>
        ) : term && found.length ? (
          <ListGroup title="Who is it about?">
            <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
              {found.map((c, i) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  showTags={false}
                  onPress={() => setContact(c)}
                  divider={i < found.length - 1}
                />
              ))}
            </ScrollView>
          </ListGroup>
        ) : (
          <Text style={styles.hint}>Search by name, email or company.</Text>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <ListGroup title="Note on">
          <View style={styles.picked}>
            <Avatar name={contact.name} email={contact.email} size={36} />
            <View style={styles.pickedText}>
              <Text style={styles.pickedName} numberOfLines={1}>
                {contact.name || contact.email}
              </Text>
              {contact.name && contact.email ? (
                <Text style={styles.hint} numberOfLines={1}>
                  {contact.email}
                </Text>
              ) : null}
            </View>
            <Button title="Change" size="sm" variant="ghost" onPress={() => setContact(null)} />
          </View>
        </ListGroup>
        <Field label="Note">
          <Input value={text} onChangeText={setText} placeholder="What should the team know?" multiline textAlignVertical="top" style={styles.multiline} autoFocus />
        </Field>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Add note" icon="plus" onPress={() => void save()} loading={busy} />
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
    gap: spacing.lg,
  },
  total: {
    ...type.monoSmall,
    color: colors.textSecondary,
    marginBottom: -spacing.xs,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  noteStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  noteHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  noteWho: {
    ...type.labelStrong,
    flex: 1,
    color: colors.foreground,
  },
  noteTime: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  noteBody: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  form: {
    gap: spacing.lg,
  },
  hint: {
    ...type.caption,
    color: colors.textSecondary,
  },
  results: {
    maxHeight: 320,
  },
  picked: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pickedText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pickedName: {
    ...type.labelStrong,
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
