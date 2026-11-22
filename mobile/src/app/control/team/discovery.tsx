import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FormFrame } from "@/components/control/team/FormFrame";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OrganiserProfile } from "@/types/control_team";

type ProfileResponse = { profile: OrganiserProfile; followers: number };

export default function DiscoveryScreen() {
  const { project } = useControl();
  const path = project ? `/api/control/team/${project.id}/discovery` : null;
  const query = useControlQuery<ProfileResponse>(path, { refetchOnFocus: false });

  if (query.data && path) {
    // Keyed by what the server holds so a save re-seeds the form.
    return <ProfileForm key={JSON.stringify(query.data.profile)} data={query.data} path={path} onSaved={(profile) => query.setData((d) => (d ? { ...d, profile } : d))} />;
  }
  return (
    <FormFrame title="Organiser profile">
      {query.error ? (
        <EmptyState icon="circle-alert" title="Couldn't load the profile" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      ) : (
        <SkeletonList rows={6} variant="card" />
      )}
    </FormFrame>
  );
}

const TEXT_FIELDS: { key: keyof Omit<OrganiserProfile, "links" | "bio">; label: string; placeholder: string; keyboard?: "url" | "email-address" }[] = [
  { key: "displayName", label: "Display name", placeholder: "Acme Live" },
  { key: "tagline", label: "Tagline", placeholder: "A short one-liner" },
  { key: "website", label: "Website", placeholder: "https://…", keyboard: "url" },
  { key: "location", label: "Location", placeholder: "London, UK" },
  { key: "contactEmail", label: "Public contact email", placeholder: "hello@acme.com", keyboard: "email-address" },
  { key: "avatarUrl", label: "Avatar URL", placeholder: "https://…", keyboard: "url" },
  { key: "bannerUrl", label: "Banner URL", placeholder: "https://…", keyboard: "url" },
];

function ProfileForm({ data, path, onSaved }: { data: ProfileResponse; path: string; onSaved: (profile: OrganiserProfile) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<OrganiserProfile>(data.profile);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.profile);
  const set = (patch: Partial<OrganiserProfile>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setSaving(true);
    const res = await controlApi<{ profile: OrganiserProfile }>(path, { method: "PATCH", body: draft });
    setSaving(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Profile saved.");
    onSaved(res.data.profile);
  };

  return (
    <FormFrame title="Organiser profile" saving={saving} dirty={dirty} onSave={() => void save()}>
      <Text style={styles.note}>
        {`Shown on your public Event Wall. ${data.followers} ${pluralize(data.followers, "follower", "followers")}.`}
      </Text>
      {TEXT_FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          <Input
            value={draft[f.key]}
            onChangeText={(v) => set({ [f.key]: v } as Partial<OrganiserProfile>)}
            placeholder={f.placeholder}
            keyboardType={f.keyboard ?? "default"}
            autoCapitalize={f.keyboard ? "none" : "sentences"}
            autoCorrect={!f.keyboard}
          />
        </Field>
      ))}
      <Field label="Bio">
        <Input value={draft.bio} onChangeText={(v) => set({ bio: v })} placeholder="Tell people who you are" multiline textAlignVertical="top" style={styles.multiline} />
      </Field>

      <SectionTitle variant="kicker">Social links</SectionTitle>
      {draft.links.map((link, i) => (
        <View key={i} style={styles.link}>
          <View style={styles.linkFields}>
            <Input value={link.label} onChangeText={(v) => set({ links: draft.links.map((l, j) => (j === i ? { ...l, label: v } : l)) })} placeholder="Label" />
            <Input
              value={link.url}
              onChangeText={(v) => set({ links: draft.links.map((l, j) => (j === i ? { ...l, url: v } : l)) })}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          <IconButton icon="trash-2" label={`Remove link ${i + 1}`} variant="plain" onPress={() => set({ links: draft.links.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <Button title="Add a link" icon="plus" variant="secondary" onPress={() => set({ links: [...draft.links, { label: "", url: "" }] })} fullWidth />
    </FormFrame>
  );
}

const styles = StyleSheet.create({
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
  multiline: {
    minHeight: 120,
    paddingTop: spacing.md,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  linkFields: {
    flex: 1,
    gap: spacing.sm,
  },
});
