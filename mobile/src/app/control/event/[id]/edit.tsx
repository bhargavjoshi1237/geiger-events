import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CoverWash } from "@/components/control/CoverWash";
import { DateStub } from "@/components/control/DateStub";
import { ChoicePicker } from "@/components/control/forms/ChoicePicker";
import { Readback, readDate } from "@/components/control/forms/DateReadback";
import { FormField } from "@/components/control/forms/FormField";
import { FormHeader, MetaText } from "@/components/control/forms/FormHeader";
import { FormPanel } from "@/components/control/forms/FormPanel";
import { FormScreen } from "@/components/control/forms/FormScreen";
import { FormSkeleton } from "@/components/control/forms/FormSkeleton";
import { SaveBar } from "@/components/control/forms/SaveBar";
import { ToggleRow } from "@/components/control/forms/ToggleRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { eventDateLine, eventDayNumeral, eventStatusMeta } from "@/lib/control_meta";
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

const SUMMARY_MAX = 5000;

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

const stagger = (i: number) => Math.min(i, 8) * 50;

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
  const query = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`, { refetchOnFocus: false });

  if (query.error && !query.data) {
    return (
      <FormScreen title="Edit details">
        <EmptyState icon="circle-alert" title="Couldn't open this event" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      </FormScreen>
    );
  }

  if (!query.data) {
    return (
      <FormScreen title="Edit details">
        <FormSkeleton panels={3} />
      </FormScreen>
    );
  }

  if (!query.data.can.edit) {
    return (
      <FormScreen title="Edit details">
        <EmptyState icon="lock" title="Your role can't edit this event" message="Ask a project admin for the Edit an event permission." />
      </FormScreen>
    );
  }

  return <EditForm key={query.data.event.id} id={id} detail={query.data} />;
}

function EditForm({ id, detail }: { id: string; detail: ControlEventDetail }) {
  const router = useRouter();
  const toast = useToast();
  const seed = useMemo(() => toDraft(detail), [detail]);
  const [draft, setDraft] = useState<Draft>(seed);
  const [busy, setBusy] = useState(false);

  const patch = useMemo(() => patchOf(seed, draft), [seed, draft]);
  const changeCount = Object.keys(patch).length;
  const dirty = changeCount > 0;
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

  const { event } = detail;
  const status = eventStatusMeta(event.status);
  const reading = readDate(draft.date, draft.time);
  const cap = Number(draft.capacity || "0");
  const left = cap - event.sold;
  let step = 0;

  return (
    <FormScreen
      title="Edit details"
      backdrop={<CoverWash uri={event.coverUrl} numeral={eventDayNumeral(event.date)} height={300} />}
      footer={<SaveBar title="Save changes" changes={changeCount} onPress={() => void save()} loading={busy} disabled={!dirty || busy} />}
    >
      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormHeader
          leading={
            event.coverUrl ? (
              <Image source={{ uri: event.coverUrl }} contentFit="cover" transition={200} style={styles.thumb} />
            ) : (
              <DateStub date={event.date} today={event.when === "today"} size="lg" />
            )
          }
          title={event.name}
          meta={
            <>
              <Pill label={status.label} tone={status.tone} />
              <MetaText>{eventDateLine(event)}</MetaText>
            </>
          }
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Basics">
          <FormField label="Name" required>
            <Input value={draft.name} onChangeText={(name) => set({ name })} placeholder="Event name" maxLength={200} />
          </FormField>
          <FormField label="Format">
            <ChoicePicker options={TYPE_OPTIONS} value={draft.type} onChange={(v) => set({ type: v as ControlEventType })} label="Format" />
          </FormField>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="When">
          <View style={styles.when}>
            <View style={styles.pair}>
              <View style={styles.half}>
                <FormField label="Date">
                  <Input
                    value={draft.date}
                    onChangeText={(date) => set({ date })}
                    placeholder="2026-12-01"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                    maxLength={10}
                    style={styles.figure}
                  />
                </FormField>
              </View>
              <View style={styles.half}>
                <FormField label="Time">
                  <Input
                    value={draft.time}
                    onChangeText={(time) => set({ time })}
                    placeholder="19:30"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                    maxLength={5}
                    style={styles.figure}
                  />
                </FormField>
              </View>
            </View>
            {reading ? <Readback reading={reading} /> : <Text style={styles.hint}>No date yet; the event stays unscheduled.</Text>}
          </View>
          <FormField label="Time zone" hint="For example Europe/London or America/New_York.">
            <Input
              leftIcon="globe"
              value={draft.timezone}
              onChangeText={(timezone) => set({ timezone })}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={64}
              style={styles.figure}
            />
          </FormField>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Where">
          <FormField label="Venue">
            <Input leftIcon="map-pin" value={draft.venue} onChangeText={(venue) => set({ venue })} placeholder="Venue name" maxLength={200} />
          </FormField>
          <FormField label="Address">
            <Input value={draft.address} onChangeText={(address) => set({ address })} placeholder="Street address" maxLength={300} />
          </FormField>
          <FormField label="City">
            <Input value={draft.city} onChangeText={(city) => set({ city })} placeholder="City" maxLength={120} />
          </FormField>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Capacity" footer="0 means no cap.">
          <FormField
            label="Places"
            aside={`${event.sold} sold`}
            status={
              cap > 0 ? (
                <View style={styles.meter}>
                  <TickMeter value={event.sold} max={cap} ticks={36} height={12} label={`${event.sold} of ${cap} sold`} />
                  <Text style={[styles.meterNote, left < 0 && styles.meterOver]}>
                    {left < 0 ? `${-left} more sold than this allows` : left === 0 ? "At capacity" : `${left} left to sell`}
                  </Text>
                </View>
              ) : null
            }
          >
            <Input
              leftIcon="users"
              value={draft.capacity}
              onChangeText={(capacity) => set({ capacity: capacity.replace(/[^0-9]/g, "") })}
              keyboardType="number-pad"
              maxLength={8}
              style={styles.figure}
            />
          </FormField>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Publishing">
          <FormField label="Visibility" hint="Unlisted events open by link only; private ones are hidden from buyers.">
            <ChoicePicker options={VISIBILITY_OPTIONS} value={draft.visibility} onChange={(v) => set({ visibility: v as ControlVisibility })} label="Visibility" />
          </FormField>
          <ToggleRow
            label="Show on your Event Wall"
            hint="List this event on the project's public wall"
            value={draft.isListable}
            onValueChange={(isListable) => set({ isListable })}
          />
          <FormField label="Organiser">
            <Input leftIcon="briefcase" value={draft.organizer} onChangeText={(organizer) => set({ organizer })} placeholder="Shown on the event page" maxLength={200} />
          </FormField>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="About">
          <FormField label="Summary" aside={`${draft.summary.length} / ${SUMMARY_MAX}`}>
            <Input
              value={draft.summary}
              onChangeText={(summary) => set({ summary })}
              placeholder="What buyers should know"
              multiline
              maxLength={SUMMARY_MAX}
              style={styles.multiline}
            />
          </FormField>
        </FormPanel>
      </Animated.View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: 62,
    height: 62,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
  },
  when: {
    gap: spacing.md,
  },
  pair: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
  },
  figure: {
    ...type.mono,
    fontSize: 15,
    lineHeight: 20,
  },
  meter: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  meterNote: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  meterOver: {
    color: colors.warning,
  },
  multiline: {
    minHeight: 120,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
});
