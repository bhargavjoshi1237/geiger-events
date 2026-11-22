import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ContactRow } from "@/components/control/guests/ContactRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
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
import type { GuestContact } from "@/types/control_guests";

const stagger = (i: number) => Math.min(i, 8) * 50;

// The server sorts by name; letters are bucketed here so the book reads A to Z, with anything else under "#".
function byLetter(contacts: GuestContact[]): { letter: string; items: GuestContact[] }[] {
  const map = new Map<string, GuestContact[]>();
  for (const c of contacts) {
    const first = (c.name || c.email).trim().charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : "#";
    const bucket = map.get(letter);
    if (bucket) bucket.push(c);
    else map.set(letter, [c]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
    .map(([letter, items]) => ({ letter, items }));
}

export default function ContactBookScreen() {
  const router = useRouter();
  const { tag: tagParam } = useLocalSearchParams<{ tag?: string }>();
  const { project } = useControl();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [tag, setTag] = useState(tagParam ?? "");
  const [adding, setAdding] = useState(false);

  // Server-side search, so typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const params = [term ? `q=${encodeURIComponent(term)}` : "", tag ? `tag=${encodeURIComponent(tag)}` : ""].filter(Boolean).join("&");
  const list = useControlQuery<{ contacts: GuestContact[]; truncated: boolean }>(
    project ? `/api/control/guests/projects/${project.id}/contacts${params ? `?${params}` : ""}` : null,
  );
  const contacts = useMemo(() => list.data?.contacts ?? [], [list.data]);
  const groups = useMemo(() => byLetter(contacts), [contacts]);
  const filtered = Boolean(term || tag);

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in More first." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load contacts" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={8} variant="divided" />;
  } else if (!contacts.length) {
    body = filtered ? (
      <EmptyState
        icon="search"
        title="No matching contacts"
        message="Try another name, email or company."
        actionLabel="Clear filters"
        onAction={() => {
          setQuery("");
          setTag("");
        }}
      />
    ) : (
      <EmptyState icon="contact" title="No contacts yet" message="People who register or buy tickets are added here, and you can add anyone yourself." actionLabel="Add a contact" onAction={() => setAdding(true)} />
    );
  } else {
    const total = `${contacts.length}${list.data.truncated ? "+" : ""}`;
    body = (
      <View style={styles.stack}>
        <Text style={styles.total}>{`${total} ${pluralize(contacts.length, "contact", "contacts")}${filtered ? " found" : ""}`}</Text>
        {groups.map((group, g) => (
          <Animated.View key={group.letter} entering={FadeInDown.delay(stagger(g)).springify()}>
            <ListGroup title={group.letter}>
              {group.items.map((c, i) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  onPress={() => router.push({ pathname: "/control/guests/contacts/[id]", params: { id: c.id } })}
                  divider={i < group.items.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
        ))}
        {list.data.truncated ? <Text style={styles.note}>Showing the first 200. Search to narrow it down.</Text> : null}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Contact Book"
          right={project ? <IconButton icon="user-plus" label="Add a contact" variant="plain" onPress={() => setAdding(true)} /> : undefined}
        />
      }
    >
      <View style={styles.controls}>
        <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search name, email or company…" autoCapitalize="none" />
        {tag ? (
          <View style={styles.filter}>
            <Icon name="tag" size={14} color={colors.textSecondary} />
            <Text style={styles.filterLabel}>Tagged</Text>
            <View style={styles.filterTag}>
              <Pill label={tag} tone="neutral" variant="outline" dot={false} />
            </View>
            <Button title="Clear" size="sm" variant="ghost" icon="x" onPress={() => setTag("")} />
          </View>
        ) : null}
      </View>
      {body}
      {project ? (
        <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a contact">
          <AddContactForm
            projectId={project.id}
            onClose={() => setAdding(false)}
            onAdded={(contact) => {
              setAdding(false);
              router.push({ pathname: "/control/guests/contacts/[id]", params: { id: contact.id } });
            }}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

// Lives inside the sheet's body, which remounts on every open, so each opening starts blank.
function AddContactForm({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: (contact: GuestContact) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the contact a name.");
    setBusy(true);
    const res = await controlApi<{ contact: GuestContact }>(`/api/control/guests/projects/${projectId}/contacts`, {
      method: "POST",
      body: { name, email, phone, company },
    });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Contact added.");
    onAdded(res.data.contact);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="Ada Lovelace" autoCapitalize="words" />
        </Field>
        <Field label="Email">
          <Input value={email} onChangeText={setEmail} placeholder="ada@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" />
        </Field>
        <Field label="Company">
          <Input value={company} onChangeText={setCompany} placeholder="Optional" />
        </Field>
        <Text style={styles.formNote}>Add tags and notes from their page once they&apos;re in the book.</Text>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Add contact" icon="user-plus" onPress={() => void submit()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  filterLabel: {
    ...type.captionStrong,
    color: colors.textSecondary,
  },
  filterTag: {
    flex: 1,
    minWidth: 0,
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
    ...type.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  form: {
    gap: spacing.lg,
  },
  formNote: {
    ...type.caption,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
