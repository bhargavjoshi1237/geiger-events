import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CoverWash } from "@/components/control/CoverWash";
import { VENUE_ICON, venueStatus } from "@/components/control/ops/venue_meta";
import { FormPanel } from "@/components/control/team/FormPanel";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn } from "@/lib/control_meta";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsSpace, OpsVenue, OpsVenueDetail } from "@/types/control_ops";

const TYPES = ["Indoor", "Outdoor", "Hybrid", "Virtual"].map((v) => ({ value: v, label: v }));
const STATUSES = ["Active", "Inactive", "Archived"].map((v) => ({ value: v, label: v }));
const stagger = (i: number) => Math.min(i, 8) * 50;
const num = (n: number) => n.toLocaleString("en-US");

type TextKey =
  | "name"
  | "description"
  | "address"
  | "city"
  | "region"
  | "postcode"
  | "country"
  | "timezone"
  | "parkingNotes"
  | "transitNotes"
  | "contactName"
  | "contactEmail"
  | "contactPhone"
  | "website";

type Draft = Pick<OpsVenue, TextKey | "type" | "status"> & { seatedCapacity: string; standingCapacity: string };

function draftOf(v: OpsVenue): Draft {
  return {
    name: v.name,
    type: v.type,
    status: v.status,
    description: v.description,
    address: v.address,
    city: v.city,
    region: v.region,
    postcode: v.postcode,
    country: v.country,
    timezone: v.timezone,
    parkingNotes: v.parkingNotes,
    transitNotes: v.transitNotes,
    contactName: v.contactName,
    contactEmail: v.contactEmail,
    contactPhone: v.contactPhone,
    website: v.website,
    seatedCapacity: String(v.seatedCapacity || ""),
    standingCapacity: String(v.standingCapacity || ""),
  };
}

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const detail = useControlQuery<OpsVenueDetail>(`/api/control/ops/venues/${id}`, { refetchOnFocus: false });

  if (detail.data) {
    // Keyed by the saved venue so a save re-seeds the form from the server.
    return <VenueEditor key={JSON.stringify(detail.data.venue)} detail={detail.data} onSaved={(next) => detail.setData(next)} />;
  }
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Venue" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {detail.error ? (
          <EmptyState icon="circle-alert" title="Couldn't open this venue" message={detail.error} actionLabel="Try again" onAction={() => void detail.reload()} />
        ) : (
          <SkeletonList rows={4} variant="card" />
        )}
      </ScrollView>
    </View>
  );
}

function VenueEditor({ detail, onSaved }: { detail: OpsVenueDetail; onSaved: (next: OpsVenueDetail) => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const original = draftOf(detail.venue);
  const [draft, setDraft] = useState<Draft>(original);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const venue = detail.venue;
  const status = venueStatus(venue.status);
  const place = [venue.city, venue.region, venue.country].filter(Boolean).join(", ");
  const address = [venue.address, venue.postcode].filter(Boolean).join(", ");
  let step = 0;

  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof Draft)[]) {
    if (draft[key] === original[key]) continue;
    changes[key] = key === "seatedCapacity" || key === "standingCapacity" ? Number(draft[key] || 0) : draft[key];
  }
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    if (!draft.name.trim()) return toast.error("Give the venue a name.");
    for (const key of ["seatedCapacity", "standingCapacity"] as const) {
      if (key in changes && !Number.isInteger(changes[key])) return toast.error("Capacity must be a whole number.");
    }
    setSaving(true);
    const res = await controlApi<OpsVenueDetail>(`/api/control/ops/venues/${detail.venue.id}`, { method: "PATCH", body: changes });
    setSaving(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Venue saved.");
    onSaved(res.data);
  };

  const text = (key: TextKey, label: string, options: { multiline?: boolean; keyboard?: "email-address" | "url" | "phone-pad"; placeholder?: string } = {}) => (
    <Field label={label}>
      <Input
        value={draft[key]}
        onChangeText={(v) => set({ [key]: v } as Partial<Draft>)}
        placeholder={options.placeholder}
        multiline={options.multiline}
        textAlignVertical={options.multiline ? "top" : undefined}
        style={options.multiline ? styles.multiline : undefined}
        keyboardType={options.keyboard ?? "default"}
        autoCapitalize={options.keyboard ? "none" : "sentences"}
      />
    </Field>
  );

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {venue.coverUrl ? (
        <View pointerEvents="none" style={styles.backdrop}>
          <CoverWash uri={venue.coverUrl} height={320} />
        </View>
      ) : null}
      <ScreenHeader title="Venue" right={<Button title="Save" size="sm" onPress={() => void save()} loading={saving} disabled={!dirty || saving} />} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          {/* The header shows the saved venue; the form below holds the edits until Save. */}
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
            <View style={styles.heroTop}>
              {venue.coverUrl ? (
                <Image source={{ uri: venue.coverUrl }} contentFit="cover" transition={150} style={styles.thumb} />
              ) : (
                <IconTile icon={VENUE_ICON[venue.type] ?? "map-pin"} size={60} />
              )}
              <View style={styles.heroText}>
                <Text style={styles.name} numberOfLines={3}>
                  {venue.name}
                </Text>
                <View style={styles.metaRow}>
                  <Pill label={status.label} tone={status.tone} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {[venue.type, venue.timezone].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
            </View>
            {place || address ? (
              <Text style={styles.place} numberOfLines={2}>
                {[address, place].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Readout
              items={[
                { label: "Seated", value: venue.seatedCapacity ? num(venue.seatedCapacity) : "—" },
                { label: "Standing", value: venue.standingCapacity ? num(venue.standingCapacity) : "—" },
                { label: "Spaces", value: String(detail.spaces.length), hint: `${detail.spaces.filter((s) => s.bookable).length} bookable` },
              ]}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <FormPanel title="Basics">
              {text("name", "Name")}
              <Field label="Type">
                <FilterChips options={TYPES} value={draft.type} onChange={(v) => set({ type: v as OpsVenue["type"] })} />
              </Field>
              <Field label="Status">
                <Segmented options={STATUSES} value={draft.status} onChange={(v) => set({ status: v as OpsVenue["status"] })} />
              </Field>
              {text("description", "Description", { multiline: true })}
            </FormPanel>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <FormPanel title="Location">
              {text("address", "Address")}
              {text("city", "City")}
              <View style={styles.pair}>
                <View style={styles.pairCell}>{text("region", "Region")}</View>
                <View style={styles.pairCell}>{text("postcode", "Postcode")}</View>
              </View>
              {text("country", "Country")}
              {text("timezone", "Time zone", { placeholder: "Europe/London" })}
            </FormPanel>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <FormPanel title="Capacity">
              <View style={styles.pair}>
                <View style={styles.pairCell}>
                  <Field label="Seated">
                    <Input value={draft.seatedCapacity} onChangeText={(v) => set({ seatedCapacity: v.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="0" style={styles.figureInput} />
                  </Field>
                </View>
                <View style={styles.pairCell}>
                  <Field label="Standing">
                    <Input value={draft.standingCapacity} onChangeText={(v) => set({ standingCapacity: v.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="0" style={styles.figureInput} />
                  </Field>
                </View>
              </View>
            </FormPanel>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <FormPanel title="Getting there">
              {text("parkingNotes", "Parking", { multiline: true })}
              {text("transitNotes", "Public transport", { multiline: true })}
            </FormPanel>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <FormPanel title="Contact">
              {text("contactName", "Name")}
              {text("contactEmail", "Email", { keyboard: "email-address" })}
              {text("contactPhone", "Phone", { keyboard: "phone-pad" })}
              {text("website", "Website", { keyboard: "url", placeholder: "https://…" })}
            </FormPanel>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            {!detail.spaces.length ? (
              <View>
                <SectionTitle variant="kicker">Spaces</SectionTitle>
                <EmptyState icon="door-open" title="No spaces yet" message="Add rooms, halls, layouts and photos on the dashboard." />
              </View>
            ) : (
              <ListGroup title={`Spaces · ${detail.spaces.length}`} footer="Layouts, seat maps, contracts and photos are edited on the dashboard.">
                {detail.spaces.map((s, i) => (
                  <SpaceRow key={s.id} space={s} divider={i < detail.spaces.length - 1} />
                ))}
              </ListGroup>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// A room or hall: what it is and where, with its capacity and hourly rate in mono on the right.
function SpaceRow({ space: s, divider }: { space: OpsSpace; divider: boolean }) {
  const line = [s.kind, s.floor ? `Floor ${s.floor}` : ""].filter(Boolean).join(" · ");
  return (
    <View style={[styles.spaceRow, divider && styles.divided]}>
      <IconTile icon="door-open" size={36} />
      <View style={styles.spaceStack}>
        <Text style={styles.spaceName} numberOfLines={1}>
          {s.name}
        </Text>
        {line ? (
          <Text style={styles.spaceLine} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
      </View>
      <View style={styles.spaceFigures}>
        {s.maxCapacity ? (
          <Text style={styles.spaceCap}>
            {num(s.maxCapacity)}
            <Text style={styles.spaceUnit}> max</Text>
          </Text>
        ) : null}
        {s.bookable && s.rateHourly != null ? <Text style={styles.spaceRate}>{`${moneyIn(s.rateHourly, s.currency)}/hr`}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  name: {
    ...type.title,
    color: colors.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  place: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  pair: {
    flexDirection: "row",
    gap: spacing.md,
  },
  pairCell: {
    flex: 1,
    minWidth: 0,
  },
  figureInput: {
    ...type.mono,
    fontSize: 15,
  },
  multiline: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  spaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  spaceStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  spaceName: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  spaceLine: {
    ...type.caption,
    color: colors.textSecondary,
  },
  spaceFigures: {
    alignItems: "flex-end",
    gap: 2,
  },
  spaceCap: {
    ...type.mono,
    color: colors.foreground,
  },
  spaceUnit: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
  spaceRate: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
