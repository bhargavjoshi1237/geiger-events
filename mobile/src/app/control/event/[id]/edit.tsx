import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlEventDetail, ControlEventPatch, ControlEventType, ControlVisibility } from "@/types/portal";

const TYPE_OPTIONS: { value: ControlEventType; label: string }[] = [
  { value: "In-person", label: "In person" },
  { value: "Online", label: "Online" },
  { value: "Hybrid", label: "Hybrid" },
];

const VISIBILITY_OPTIONS: { value: ControlVisibility; label: string }[] = [
  { value: "Public", label: "Public" },
  { value: "Unlisted", label: "Unlisted" },
  { value: "Private", label: "Private" },
];

type Draft = {
  name: string;
  type: ControlEventType;
  date: string;
  time: string;
  timezone: string;
  venue: string;
  address: string;
  city: string;
  capacity: string;
  visibility: ControlVisibility;
  organizer: string;
  summary: string;
  isListable: boolean;
};

const TEXT_KEYS = ["name", "timezone", "venue", "address", "city", "organizer", "summary"] as const;

function toDraft({ event, details }: ControlEventDetail): Draft {
  return {
    name: event.name,
    type: details.type,
    date: event.date ?? "",
    time: event.time ? event.time.slice(0, 5) : "",
    timezone: event.timezone,
    venue: event.venue ?? "",
    address: details.address,
    city: event.city ?? "",
    capacity: String(event.capacity ?? 0),
    visibility: details.visibility,
    organizer: details.organizer,
    summary: details.summary,
    isListable: details.isListable,
  };
}

// Only what changed is sent, so a save never overwrites a field someone else edited on the dashboard meanwhile.
function patchOf(seed: Draft, draft: Draft): ControlEventPatch {
  const patch: ControlEventPatch = {};
  for (const key of TEXT_KEYS) {
    if (draft[key].trim() !== seed[key].trim()) patch[key] = draft[key].trim();
  }
  if (draft.type !== seed.type) patch.type = draft.type;
  if (draft.visibility !== seed.visibility) patch.visibility = draft.visibility;
  if (draft.isListable !== seed.isListable) patch.isListable = draft.isListable;
  if (draft.date.trim() !== seed.date) patch.date = draft.date.trim() || null;
  if (draft.time.trim() !== seed.time) patch.time = draft.time.trim() || null;
  if (draft.capacity.trim() !== seed.capacity) patch.capacity = Number(draft.capacity.trim() || "0");
  return patch;
}

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const query = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`, { refetchOnFocus: false });

  const header = (
    <View style={[styles.headerPad, { paddingTop: insets.top }]}>
      <ScreenHeader title="Edit details" />
    </View>
  );

  if (query.error && !query.data) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.pad}>
          <EmptyState icon="circle-alert" title="Couldn't open this event" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
        </View>
      </View>
    );
  }

  if (!query.data) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.pad}>
          <SkeletonList rows={5} variant="divided" />
        </View>
      </View>
    );
  }

  if (!query.data.can.edit) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.pad}>
          <EmptyState icon="lock" title="Your role can't edit this event" message="Ask a project admin for the Edit an event permission." />
        </View>
      </View>
    );
  }

  return <EditForm key={query.data.event.id} id={id} detail={query.data} />;
}

function EditForm({ id, detail }: { id: string; detail: ControlEventDetail }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const seed = useMemo(() => toDraft(detail), [detail]);
  const [draft, setDraft] = useState<Draft>(seed);
  const [busy, setBusy] = useState(false);

  const patch = useMemo(() => patchOf(seed, draft), [seed, draft]);
  const dirty = Object.keys(patch).length > 0;
  const set = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));

  const save = async () => {
    if (!draft.name.trim()) return toast.error("Give the event a name.");
    if ("capacity" in patch && (!Number.isInteger(patch.capacity) || (patch.capacity ?? 0) < 0)) {
      return toast.error("Capacity must be a whole number, 0 or more.");
    }
    setBusy(true);
    const res = await controlApi<ControlEventDetail>(`/api/control/events/${id}`, { method: "PATCH", body: patch });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      toast.error(res.error);
      return;
    }
    successFeedback();
    toast.success("Saved");
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.headerPad, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Edit details"
          right={<Button title="Save" size="sm" onPress={() => void save()} loading={busy} disabled={!dirty || busy} />}
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Field label="Name">
            <Input value={draft.name} onChangeText={(name) => set({ name })} placeholder="Event name" maxLength={200} />
          </Field>
          <Field label="Format">
            <Segmented options={TYPE_OPTIONS} value={draft.type} onChange={(v) => set({ type: v as ControlEventType })} />
          </Field>
        </View>

        <SectionTitle variant="kicker">When</SectionTitle>
        <View style={styles.section}>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="Date" hint="YYYY-MM-DD">
                <Input
                  value={draft.date}
                  onChangeText={(date) => set({ date })}
                  placeholder="2026-12-01"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  maxLength={10}
                />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="Time" hint="24-hour HH:MM">
                <Input
                  value={draft.time}
                  onChangeText={(time) => set({ time })}
                  placeholder="19:30"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  maxLength={5}
                />
              </Field>
            </View>
          </View>
          <Field label="Time zone" hint="For example Europe/London or America/New_York">
            <Input value={draft.timezone} onChangeText={(timezone) => set({ timezone })} autoCapitalize="none" autoCorrect={false} maxLength={64} />
          </Field>
        </View>

        <SectionTitle variant="kicker">Where</SectionTitle>
        <View style={styles.section}>
          <Field label="Venue">
            <Input value={draft.venue} onChangeText={(venue) => set({ venue })} placeholder="Venue name" maxLength={200} />
          </Field>
          <Field label="Address">
            <Input value={draft.address} onChangeText={(address) => set({ address })} placeholder="Street address" maxLength={300} />
          </Field>
          <Field label="City">
            <Input value={draft.city} onChangeText={(city) => set({ city })} placeholder="City" maxLength={120} />
          </Field>
          <Field label="Capacity" hint="0 means no cap">
            <Input value={draft.capacity} onChangeText={(capacity) => set({ capacity: capacity.replace(/[^0-9]/g, "") })} keyboardType="number-pad" maxLength={8} />
          </Field>
        </View>

        <SectionTitle variant="kicker">Publishing</SectionTitle>
        <View style={styles.section}>
          <Field label="Visibility" hint="Unlisted events open by link only; private ones are hidden from buyers.">
            <Segmented options={VISIBILITY_OPTIONS} value={draft.visibility} onChange={(v) => set({ visibility: v as ControlVisibility })} />
          </Field>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>Show on your Event Wall</Text>
              <Text style={styles.switchHint}>List this event on the project&apos;s public wall</Text>
            </View>
            <Switch value={draft.isListable} onValueChange={(isListable) => set({ isListable })} label="Show on your Event Wall" />
          </View>
          <Field label="Organiser">
            <Input value={draft.organizer} onChangeText={(organizer) => set({ organizer })} placeholder="Shown on the event page" maxLength={200} />
          </Field>
        </View>

        <SectionTitle variant="kicker">About</SectionTitle>
        <View style={styles.section}>
          <Field label="Summary">
            <Input
              value={draft.summary}
              onChangeText={(summary) => set({ summary })}
              placeholder="What buyers should know"
              multiline
              maxLength={5000}
              style={styles.multiline}
            />
          </Field>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerPad: {
    paddingHorizontal: spacing.lg,
  },
  pad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  section: {
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  pair: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    ...type.label,
    color: colors.foreground,
  },
  switchHint: {
    ...type.caption,
    color: colors.textSecondary,
  },
  multiline: {
    minHeight: 120,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
});
