import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DateStub } from "@/components/control/DateStub";
import { Readback, readDate } from "@/components/control/forms/DateReadback";
import { FormField } from "@/components/control/forms/FormField";
import { FormHeader, MetaText } from "@/components/control/forms/FormHeader";
import { FormPanel } from "@/components/control/forms/FormPanel";
import { FormScreen } from "@/components/control/forms/FormScreen";
import { SaveBar } from "@/components/control/forms/SaveBar";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControl } from "@/state/control";
import { spacing, type } from "@/theme/tokens";
import type { ControlEvent, ControlEventPatch } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function NewEventScreen() {
  const router = useRouter();
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

  const reading = readDate(date, time);
  const place = [venue.trim(), city.trim()].filter(Boolean).join(", ");
  let step = 0;

  return (
    <FormScreen
      title="New event"
      subtitle={project?.name}
      footer={<SaveBar title="Create event" icon="plus" note="Starts as a draft only your team can see." onPress={() => void submit()} loading={busy} disabled={busy} />}
    >
      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        {/* The stub and title preview the event as it's typed. */}
        <FormHeader
          leading={<DateStub date={date.trim()} size="lg" />}
          title={name.trim() || "Untitled event"}
          placeholder={!name.trim()}
          meta={
            <>
              <Pill label="Draft" tone="neutral" />
              {place ? <MetaText>{place}</MetaText> : null}
            </>
          }
          description="Add tickets once it's created, then publish it from the event."
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Event">
          <FormField label="Name" required>
            <Input value={name} onChangeText={setName} placeholder="e.g. Summer Finals" autoFocus returnKeyType="next" />
          </FormField>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="When" footer="Both optional; an event with no date stays unscheduled.">
          <View style={styles.when}>
            <View style={styles.pair}>
              <View style={styles.half}>
                <FormField label="Date">
                  <Input
                    value={date}
                    onChangeText={setDate}
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
                    value={time}
                    onChangeText={setTime}
                    placeholder="19:30"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                    maxLength={5}
                    style={styles.figure}
                  />
                </FormField>
              </View>
            </View>
            {reading ? <Readback reading={reading} /> : null}
          </View>
        </FormPanel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <FormPanel title="Where">
          <FormField label="Venue">
            <Input leftIcon="map-pin" value={venue} onChangeText={setVenue} placeholder="e.g. Town Hall" />
          </FormField>
          <FormField label="City">
            <Input value={city} onChangeText={setCity} placeholder="e.g. Leeds" />
          </FormField>
          <FormField label="Capacity" hint="Leave blank to set it later.">
            <Input leftIcon="users" value={capacity} onChangeText={setCapacity} placeholder="500" keyboardType="number-pad" style={styles.figure} />
          </FormField>
        </FormPanel>
      </Animated.View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
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
  figure: {
    ...type.mono,
    fontSize: 15,
    lineHeight: 20,
  },
});
