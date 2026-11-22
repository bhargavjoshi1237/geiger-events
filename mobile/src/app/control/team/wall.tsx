import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormFrame } from "@/components/control/team/FormFrame";
import { FormPanel } from "@/components/control/team/FormPanel";
import { Notice } from "@/components/control/team/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { EventWallSettings } from "@/types/control_team";

type WallResponse = { wall: EventWallSettings; canEdit: boolean };

const CTA_STYLES = [
  { value: "solid", label: "Solid" },
  { value: "outline", label: "Outline" },
];

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function EventWallScreen() {
  const { project } = useControl();
  const path = project ? `/api/control/team/${project.id}/wall` : null;
  const query = useControlQuery<WallResponse>(path, { refetchOnFocus: false });

  if (query.data && path) {
    return <WallForm key={JSON.stringify(query.data.wall)} data={query.data} path={path} onSaved={(next) => query.setData(next)} />;
  }
  return (
    <FormFrame title="Event Wall">
      {query.error ? (
        <EmptyState icon="circle-alert" title="Couldn't load the Event Wall" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      ) : (
        <SkeletonList rows={5} variant="card" />
      )}
    </FormFrame>
  );
}

// Same rule as the server and the dashboard's custom URL field.
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function WallForm({ data, path, onSaved }: { data: WallResponse; path: string; onSaved: (next: WallResponse) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<EventWallSettings>(data.wall);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.wall);
  const set = (patch: Partial<EventWallSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const setCta = (patch: Partial<EventWallSettings["cta"]>) => setDraft((d) => ({ ...d, cta: { ...d.cta, ...patch } }));
  const address = `${SUITE_ORIGIN}/events/w/${slugify(draft.slug) || "…"}`;
  let step = 0;

  const save = async () => {
    const body: Record<string, unknown> = {};
    for (const key of ["name", "tagline", "logoUrl", "slug"] as const) if (draft[key] !== data.wall[key]) body[key] = draft[key];
    if (JSON.stringify(draft.cta) !== JSON.stringify(data.wall.cta)) body.cta = draft.cta;
    setSaving(true);
    const res = await controlApi<WallResponse>(path, { method: "PATCH", body });
    setSaving(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Event Wall saved.");
    onSaved(res.data);
  };

  const editable = data.canEdit;
  return (
    <FormFrame title="Event Wall" saving={saving} dirty={dirty && editable} onSave={editable ? () => void save() : undefined}>
      {/* The header shows the saved logo, so typing a URL doesn't fetch on every keystroke. */}
      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
        {data.wall.logoUrl ? (
          <Image source={{ uri: data.wall.logoUrl }} contentFit="contain" transition={150} style={styles.thumb} />
        ) : (
          <IconTile icon="layout-grid" size={60} />
        )}
        <View style={styles.heroText}>
          <Text style={styles.name} numberOfLines={2}>
            {draft.name || "Your events page"}
          </Text>
          <Text style={styles.address} numberOfLines={2} selectable>
            {address.replace(/^https?:\/\//, "")}
          </Text>
        </View>
      </Animated.View>

      {!editable ? (
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Notice text="Your role can see the Event Wall but not change it." />
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Page">
          <Field label="Page name" hint="The heading on your public events page.">
            <Input value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="Our Events" editable={editable} />
          </Field>
          <Field label="Tagline">
            <Input value={draft.tagline} onChangeText={(v) => set({ tagline: v })} placeholder="Discover what's happening." multiline textAlignVertical="top" editable={editable} />
          </Field>
          <Field label="Logo URL" hint="Leave blank to use the Geiger logo.">
            <Input value={draft.logoUrl} onChangeText={(v) => set({ logoUrl: v })} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={editable} />
          </Field>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Web address">
          <Field label="Custom path" hint={address}>
            <Input value={draft.slug} onChangeText={(v) => set({ slug: v })} placeholder="events" autoCapitalize="none" autoCorrect={false} editable={editable} />
          </Field>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Call to action" footer="An extra button under Follow. It shows only when both a label and a link are set.">
          <Field label="Button label">
            <Input value={draft.cta.label} onChangeText={(v) => setCta({ label: v })} placeholder="Become a sponsor" editable={editable} />
          </Field>
          <Field label="Link" hint="A URL, or mailto: for an email address.">
            <Input value={draft.cta.url} onChangeText={(v) => setCta({ url: v })} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={editable} />
          </Field>
          <Field label="Style">
            <Segmented options={CTA_STYLES} value={draft.cta.style} onChange={(v) => editable && setCta({ style: v === "outline" ? "outline" : "solid" })} />
          </Field>
        </FormPanel>
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
  address: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
});
