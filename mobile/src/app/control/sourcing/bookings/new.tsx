import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OptionPicker } from "@/components/control/sourcing/OptionPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Bookables, BookingEmailResult, BookingQuote, VenueBooking } from "@/types/control_sourcing";

const pad = (n: number) => String(n).padStart(2, "0");

// Tomorrow on the phone's calendar, the dashboard's default starting point.
function tomorrow(): string {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function NewBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { project, teamEmail } = useControl();
  const data = useControlQuery<Bookables>(project ? `/api/control/sourcing/projects/${project.id}/bookables` : null, { refetchOnFocus: false });

  const [venueId, setVenueId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [date, setDate] = useState(tomorrow);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(tomorrow);
  const [endTime, setEndTime] = useState("17:00");
  const [setupStyle, setSetupStyle] = useState("");
  const [attendees, setAttendees] = useState("");
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState(teamEmail ?? "");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [hold, setHold] = useState(false);
  const [holdHours, setHoldHours] = useState("48");
  const [notify, setNotify] = useState(true);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [busy, setBusy] = useState<"quote" | "book" | null>(null);

  const venues = data.data?.venues ?? [];
  const venue = venues.find((v) => v.id === venueId) ?? venues[0] ?? null;
  const spaces = useMemo(() => (data.data?.spaces ?? []).filter((s) => s.venueId === venue?.id), [data.data, venue]);
  const space = spaces.find((s) => s.id === spaceId) ?? spaces[0] ?? null;

  const request = () => ({
    spaceId: space?.id,
    date,
    startTime,
    endDate: endDate || date,
    endTime,
    setupStyle,
    attendees: attendees.trim() ? Number(attendees) : 0,
    title,
    eventId: eventId || null,
    contactName,
    contactEmail,
    contactPhone,
    notes,
    status: hold ? "hold" : "confirmed",
    holdHours: Number(holdHours),
    notify,
  });

  const check = async () => {
    if (!project || !space) return;
    setBusy("quote");
    const res = await controlApi<BookingQuote>(`/api/control/sourcing/projects/${project.id}/bookings/quote`, { method: "POST", body: request() });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      setQuote(null);
      return toast.error(res.error);
    }
    setQuote(res.data);
    if (!res.data.ok) errorFeedback();
  };

  const book = async () => {
    if (!project || !space) return;
    setBusy("book");
    const res = await controlApi<{ booking: VenueBooking; email: BookingEmailResult }>(`/api/control/sourcing/projects/${project.id}/bookings`, { method: "POST", body: request() });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    const b = res.data.booking;
    toast.success(b.status === "hold" ? `Hold ${b.reference} placed.` : `Booked ${b.reference} · ${b.totalLabel}.`);
    if (res.data.email && !res.data.email.ok) toast.error(`Email not sent: ${res.data.email.error}`);
    router.replace({ pathname: "/control/sourcing/bookings/[id]", params: { id: b.id } });
  };

  // Any change to the slot invalidates the last availability check.
  const edit = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setQuote(null);
  };

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in More first." />;
  } else if (data.error && !data.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load your spaces" message={data.error} actionLabel="Try again" onAction={() => void data.reload()} />;
  } else if (!data.data) {
    body = <SkeletonList rows={5} variant="card" />;
  } else if (!venues.length) {
    body = (
      <EmptyState
        icon="building-2"
        title="No bookable spaces"
        message="Turn on Instant Book for a venue space on the dashboard (Venues → space → Instant Book) and it appears here."
      />
    );
  } else {
    body = (
      <View style={styles.stack}>
        <SectionTitle variant="kicker">Space</SectionTitle>
        <View style={styles.card}>
          <Field label="Venue">
            <OptionPicker
              label="Venue"
              options={venues.map((v) => ({ value: v.id, label: v.name, hint: [v.city, v.timezone].filter(Boolean).join(" · ") }))}
              value={venue?.id ?? ""}
              onChange={edit((v: string) => {
                setVenueId(v);
                setSpaceId("");
              })}
            />
          </Field>
          <Field label="Space" hint={space ? [space.rates || "No published rate", space.minHours ? `${space.minHours} h minimum` : ""].filter(Boolean).join(" · ") : undefined}>
            <FilterChips options={spaces.map((s) => ({ value: s.id, label: s.name }))} value={space?.id ?? ""} onChange={edit(setSpaceId)} />
          </Field>
        </View>

        <SectionTitle variant="kicker">{`When · ${venue?.timezone ?? ""} time`}</SectionTitle>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label="Start date">
                <Input value={date} onChangeText={edit((v: string) => {
                  setDate(v);
                  if (!endDate || endDate < v) setEndDate(v);
                })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="Start time">
                <Input value={startTime} onChangeText={edit(setStartTime)} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
              </Field>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label="End date">
                <Input value={endDate} onChangeText={edit(setEndDate)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="End time">
                <Input value={endTime} onChangeText={edit(setEndTime)} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
              </Field>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label="Setup">
                <OptionPicker
                  label="Setup"
                  options={(space?.capacities.length ? space.capacities.map((c) => ({ value: c.key, label: c.label, hint: `Holds ${c.capacity}` })) : data.data.setupStyles)}
                  value={setupStyle}
                  onChange={edit(setSetupStyle)}
                  noneLabel="Any setup"
                />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="Attendees">
                <Input value={attendees} onChangeText={edit(setAttendees)} keyboardType="number-pad" placeholder="0" />
              </Field>
            </View>
          </View>
          <Button title="Check availability" icon="calendar-check" variant="secondary" loading={busy === "quote"} disabled={!space} onPress={() => void check()} fullWidth />
          {quote ? (
            quote.ok && quote.quote ? (
              <Card tone="subtle">
                <Text style={styles.ok}>Available</Text>
                {quote.quote.lines.map((line) => (
                  <Text key={line.date} style={styles.meta}>{`${line.date} · ${line.detail} · ${line.amount}`}</Text>
                ))}
                <Text style={styles.total}>{`Total ${quote.quote.total}`}</Text>
                {!quote.quote.priced ? <Text style={styles.meta}>This space has no published rate, so it books at no charge.</Text> : null}
              </Card>
            ) : (
              <Card tone="subtle">
                <Text style={styles.bad}>{quote.message || "That slot can't be booked."}</Text>
              </Card>
            )
          ) : null}
        </View>

        <SectionTitle variant="kicker">Details</SectionTitle>
        <View style={styles.card}>
          <Field label="Title" hint="Defaults to the event or space name.">
            <Input value={title} onChangeText={setTitle} />
          </Field>
          <Field label="Event">
            <OptionPicker label="Event" options={(data.data.events ?? []).map((e) => ({ value: e.id, label: e.name }))} value={eventId} onChange={setEventId} noneLabel="No event" />
          </Field>
          <Field label="Contact name">
            <Input value={contactName} onChangeText={setContactName} />
          </Field>
          <Field label="Contact email">
            <Input value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </Field>
          <Field label="Contact phone">
            <Input value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
          </Field>
          <Field label="Notes">
            <Input value={notes} onChangeText={setNotes} multiline textAlignVertical="top" style={styles.multiline} />
          </Field>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Hold instead of confirming</Text>
            <Switch value={hold} onValueChange={setHold} label="Hold instead of confirming" />
          </View>
          {hold ? (
            <Field label="Hold for">
              <FilterChips
                options={(data.data.holdHours ?? []).map((h) => ({ value: String(h), label: h >= 168 ? "7 days" : h >= 72 ? "3 days" : `${h} hours` }))}
                value={holdHours}
                onChange={setHoldHours}
              />
            </Field>
          ) : null}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Email the venue and the booker</Text>
            <Switch value={notify} onValueChange={setNotify} label="Email the venue and the booker" />
          </View>
        </View>

        <Button title={hold ? "Place hold" : "Book"} icon="calendar-check" loading={busy === "book"} disabled={!space || busy !== null} onPress={() => void book()} fullWidth />
        <Text style={styles.meta}>The server re-checks the slot and prices it from the space&apos;s rates when you book.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Book a space" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
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
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  switchLabel: {
    ...type.label,
    flex: 1,
    color: colors.foreground,
  },
  multiline: {
    minHeight: 90,
    paddingTop: spacing.md,
  },
  ok: {
    ...type.labelStrong,
    color: colors.success,
  },
  bad: {
    ...type.labelStrong,
    color: colors.danger,
  },
  total: {
    ...type.bodyStrong,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
