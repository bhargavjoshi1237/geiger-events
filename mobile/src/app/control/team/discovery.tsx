import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CoverWash } from "@/components/control/CoverWash";
import { FormFrame } from "@/components/control/team/FormFrame";
import { FormPanel } from "@/components/control/team/FormPanel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OrganiserProfile } from "@/types/control_team";

type ProfileResponse = { profile: OrganiserProfile; followers: number };

const stagger = (i: number) => Math.min(i, 8) * 50;

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

type TextKey = keyof Omit<OrganiserProfile, "links" | "bio">;
type TextField = { key: TextKey; label: string; placeholder: string; keyboard?: "url" | "email-address" };

const CONTACT_FIELDS: TextField[] = [
  { key: "website", label: "Website", placeholder: "https://…", keyboard: "url" },
  { key: "location", label: "Location", placeholder: "London, UK" },
  { key: "contactEmail", label: "Public contact email", placeholder: "hello@acme.com", keyboard: "email-address" },
];

const IMAGE_FIELDS: TextField[] = [
  { key: "avatarUrl", label: "Avatar URL", placeholder: "https://…", keyboard: "url" },
  { key: "bannerUrl", label: "Banner URL", placeholder: "https://…", keyboard: "url" },
];

function ProfileForm({ data, path, onSaved }: { data: ProfileResponse; path: string; onSaved: (profile: OrganiserProfile) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<OrganiserProfile>(data.profile);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.profile);
  const set = (patch: Partial<OrganiserProfile>) => setDraft((d) => ({ ...d, ...patch }));
  const saved = data.profile;
  let step = 0;

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

  const text = (f: TextField) => (
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
  );

  return (
    <FormFrame
      title="Organiser profile"
      saving={saving}
      dirty={dirty}
      onSave={() => void save()}
      backdrop={saved.bannerUrl ? <CoverWash uri={saved.bannerUrl} height={300} /> : undefined}
    >
      {/* The header shows the saved images, so typing a URL doesn't fetch on every keystroke. */}
      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
        {saved.avatarUrl ? (
          <Image source={{ uri: saved.avatarUrl }} contentFit="cover" transition={150} style={styles.thumb} />
        ) : draft.displayName ? (
          <Avatar name={draft.displayName} size={60} shape="square" />
        ) : (
          <IconTile icon="id-card" size={60} />
        )}
        <View style={styles.heroText}>
          <Text style={styles.name} numberOfLines={2}>
            {draft.displayName || "Your organiser name"}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {`${data.followers.toLocaleString("en-US")} ${pluralize(data.followers, "follower", "followers")}`}
          </Text>
          {draft.tagline ? (
            <Text style={styles.tagline} numberOfLines={2}>
              {draft.tagline}
            </Text>
          ) : null}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Identity" footer="Shown on your public Event Wall.">
          {text({ key: "displayName", label: "Display name", placeholder: "Acme Live" })}
          {text({ key: "tagline", label: "Tagline", placeholder: "A short one-liner" })}
          <Field label="Bio">
            <Input value={draft.bio} onChangeText={(v) => set({ bio: v })} placeholder="Tell people who you are" multiline textAlignVertical="top" style={styles.multiline} />
          </Field>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Contact">{CONTACT_FIELDS.map(text)}</FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Images" footer="Paste links to hosted images. Uploads stay on the dashboard.">
          {IMAGE_FIELDS.map(text)}
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.links}>
        <ListGroup title="Social links">
          {draft.links.length ? (
            draft.links.map((link, i) => (
              <View key={i} style={[styles.link, i < draft.links.length - 1 && styles.divided]}>
                <Text style={styles.index}>{String(i + 1).padStart(2, "0")}</Text>
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
            ))
          ) : (
            <Text style={styles.empty}>No links yet. Add Instagram, X, YouTube or anywhere else people can find you.</Text>
          )}
        </ListGroup>
        <Button title="Add a link" icon="plus" variant="secondary" onPress={() => set({ links: [...draft.links, { label: "", url: "" }] })} fullWidth />
      </Animated.View>
    </FormFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingTop: spacing.sm,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
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
  meta: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  tagline: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  multiline: {
    minHeight: 120,
    paddingTop: spacing.md,
  },
  links: {
    gap: spacing.md,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  index: {
    ...type.monoSmall,
    color: colors.textTertiary,
  },
  linkFields: {
    flex: 1,
    gap: spacing.sm,
  },
  empty: {
    ...type.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
});
