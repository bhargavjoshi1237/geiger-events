import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn } from "@/lib/control_meta";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsVenue, OpsVenueDetail } from "@/types/control_ops";

const TYPES = ["Indoor", "Outdoor", "Hybrid", "Virtual"].map((v) => ({ value: v, label: v }));
const STATUSES = ["Active", "Inactive", "Archived"].map((v) => ({ value: v, label: v }));

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
          <SkeletonList rows={5} variant="card" />
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
      <ScreenHeader title="Venue" right={<Button title="Save" size="sm" onPress={() => void save()} loading={saving} disabled={!dirty || saving} />} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          <Panel title="Basics">
            {text("name", "Name")}
            <Field label="Type">
              <FilterChips options={TYPES} value={draft.type} onChange={(v) => set({ type: v as OpsVenue["type"] })} />
            </Field>
            <Field label="Status">
              <Segmented options={STATUSES} value={draft.status} onChange={(v) => set({ status: v as OpsVenue["status"] })} />
            </Field>
            {text("description", "Description", { multiline: true })}
          </Panel>

          <Panel title="Location">
            {text("address", "Address")}
            {text("city", "City")}
            {text("region", "Region")}
            {text("postcode", "Postcode")}
            {text("country", "Country")}
            {text("timezone", "Time zone", { placeholder: "Europe/London" })}
          </Panel>

          <Panel title="Capacity">
            <Field label="Seated">
              <Input value={draft.seatedCapacity} onChangeText={(v) => set({ seatedCapacity: v.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="0" />
            </Field>
            <Field label="Standing">
              <Input value={draft.standingCapacity} onChangeText={(v) => set({ standingCapacity: v.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="0" />
            </Field>
          </Panel>

          <Panel title="Getting there">
            {text("parkingNotes", "Parking", { multiline: true })}
            {text("transitNotes", "Public transport", { multiline: true })}
          </Panel>

          <Panel title="Contact">
            {text("contactName", "Name")}
            {text("contactEmail", "Email", { keyboard: "email-address" })}
            {text("contactPhone", "Phone", { keyboard: "phone-pad" })}
            {text("website", "Website", { keyboard: "url", placeholder: "https://…" })}
          </Panel>

          <View>
            <SectionTitle variant="kicker">Spaces</SectionTitle>
            {!detail.spaces.length ? (
              <Text style={styles.caption}>No rooms or halls added yet. Add spaces and their layouts on the dashboard.</Text>
            ) : (
              <View style={styles.group}>
                {detail.spaces.map((s, i) => (
                  <ListRow
                    key={s.id}
                    leading={<IconTile icon="door-open" size={34} />}
                    title={s.name}
                    subtitle={[
                      s.kind,
                      s.floor ? `Floor ${s.floor}` : "",
                      s.maxCapacity ? `Up to ${s.maxCapacity.toLocaleString("en-US")}` : "",
                      s.bookable && s.rateHourly != null ? `${moneyIn(s.rateHourly, s.currency)}/hr` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    divider={i < detail.spaces.length - 1}
                  />
                ))}
              </View>
            )}
          </View>
          <Text style={styles.caption}>Layouts, seat maps, contracts and photos are edited on the dashboard.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <SectionTitle variant="kicker">{title}</SectionTitle>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.xl,
  },
  panel: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  caption: {
    ...type.caption,
    color: colors.textSecondary,
  },
  multiline: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
});
