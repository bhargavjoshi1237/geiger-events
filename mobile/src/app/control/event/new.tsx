import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { ControlEvent, ControlEventPatch } from "@/types/portal";

export default function NewEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { project } = useControl();
  const { success, error } = useToast();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!project) return;
    if (!name.trim()) {
      errorFeedback();
      return error("Give the event a name.");
    }
    const cap = capacity.trim() ? Number(capacity.trim()) : null;
    if (cap !== null && (!Number.isInteger(cap) || cap < 0)) {
      errorFeedback();
      return error("Capacity must be a whole number.");
    }
    // Only filled-in fields are sent so the server's defaults apply to the rest.
    const body: ControlEventPatch = { name: name.trim() };
    if (date.trim()) body.date = date.trim();
    if (time.trim()) body.time = time.trim();
    if (venue.trim()) body.venue = venue.trim();
    if (city.trim()) body.city = city.trim();
    if (cap !== null) body.capacity = cap;

    setBusy(true);
    const res = await controlApi<{ event: ControlEvent }>(`/api/control/projects/${project.id}/events`, { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return error(res.error);
    }
    successFeedback();
    success("Event created as a draft.");
    router.replace({ pathname: "/control/event/[id]", params: { id: res.data.event.id } });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="New event" subtitle={project?.name} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Field label="Name">
            <Input value={name} onChangeText={setName} placeholder="e.g. Summer Finals" autoFocus returnKeyType="next" />
          </Field>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="Date" hint="YYYY-MM-DD">
                <Input
                  value={date}
                  onChangeText={setDate}
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
                  value={time}
                  onChangeText={setTime}
                  placeholder="19:30"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  maxLength={5}
                />
              </Field>
            </View>
          </View>
          <Field label="Venue">
            <Input value={venue} onChangeText={setVenue} placeholder="e.g. Town Hall" />
          </Field>
          <Field label="City">
            <Input value={city} onChangeText={setCity} placeholder="e.g. Leeds" />
          </Field>
          <Field label="Capacity" hint="Leave blank to set it later">
            <Input value={capacity} onChangeText={setCapacity} placeholder="500" keyboardType="number-pad" />
          </Field>
          <Button title="Create event" icon="plus" onPress={() => void submit()} loading={busy} disabled={busy} fullWidth />
        </View>
        <Text style={styles.note}>It starts as a draft — add tickets, then publish it from the event.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  pair: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
});
