import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { GuestContact } from "@/types/control_guests";

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
  const contacts = list.data?.contacts ?? [];
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
    body = (
      <>
        <View style={styles.group}>
          {contacts.map((c, i) => (
            <ListRow
              key={c.id}
              leading={<Avatar name={c.name} email={c.email} size={36} />}
              title={c.name || c.email || "Unnamed"}
              subtitle={[c.email, c.company].filter(Boolean).join(" · ") || undefined}
              trailing={c.blocked ? <Pill label="Blocked" tone="danger" variant="outline" /> : undefined}
              onPress={() => router.push({ pathname: "/control/guests/contacts/[id]", params: { id: c.id } })}
              divider={i < contacts.length - 1}
            />
          ))}
        </View>
        {list.data.truncated ? <Text style={styles.note}>Showing the first 200. Search to narrow it down.</Text> : null}
      </>
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
          <View style={styles.tagRow}>
            <Pill label={`Tag: ${tag}`} tone="info" variant="outline" dot={false} />
            <Button title="Clear" size="sm" variant="ghost" onPress={() => setTag("")} />
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
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Add contact" onPress={() => void submit()} loading={busy} />
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
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: "center",
  },
  form: {
    gap: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
