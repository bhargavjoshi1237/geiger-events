import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { FormFrame } from "@/components/control/team/FormFrame";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { SUITE_ORIGIN } from "@/lib/team_auth";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, type } from "@/theme/tokens";
import type { EventWallSettings } from "@/types/control_team";

type WallResponse = { wall: EventWallSettings; canEdit: boolean };

const CTA_STYLES = [
  { value: "solid", label: "Solid" },
  { value: "outline", label: "Outline" },
];

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
      {!editable ? <Text style={styles.note}>Your role can see the Event Wall but not change it.</Text> : null}
      <Field label="Page name" hint="The heading on your public events page.">
        <Input value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="Our Events" editable={editable} />
      </Field>
      <Field label="Tagline">
        <Input value={draft.tagline} onChangeText={(v) => set({ tagline: v })} placeholder="Discover what's happening." multiline textAlignVertical="top" editable={editable} />
      </Field>
      <Field label="Logo URL" hint="Leave blank to use the Geiger logo.">
        <Input value={draft.logoUrl} onChangeText={(v) => set({ logoUrl: v })} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={editable} />
      </Field>
      <Field label="Web address" hint={`${SUITE_ORIGIN}/events/w/${slugify(draft.slug) || "…"}`}>
        <Input value={draft.slug} onChangeText={(v) => set({ slug: v })} placeholder="events" autoCapitalize="none" autoCorrect={false} editable={editable} />
      </Field>

      <SectionTitle variant="kicker">Call to action</SectionTitle>
      <Text style={styles.note}>An extra button under Follow. It shows only when both a label and a link are set.</Text>
      <Field label="Button label">
        <Input value={draft.cta.label} onChangeText={(v) => setCta({ label: v })} placeholder="Become a sponsor" editable={editable} />
      </Field>
      <Field label="Link" hint="A URL, or mailto: for an email address.">
        <Input value={draft.cta.url} onChangeText={(v) => setCta({ url: v })} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={editable} />
      </Field>
      <Field label="Style">
        <Segmented options={CTA_STYLES} value={draft.cta.style} onChange={(v) => editable && setCta({ style: v === "outline" ? "outline" : "solid" })} />
      </Field>
    </FormFrame>
  );
}

const styles = StyleSheet.create({
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
