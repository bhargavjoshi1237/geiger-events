import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CoverWash } from "@/components/control/CoverWash";
import { DateStub } from "@/components/control/DateStub";
import { LedgerRow, LedgerTotal } from "@/components/control/sourcing/Ledger";
import { BOOKING_STATUS } from "@/components/control/sourcing/meta";
import { venueDate } from "@/components/control/sourcing/when";
import { StatusButton } from "@/components/control/StatusButton";
import { DetailRow } from "@/components/DetailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { eventDayNumeral } from "@/lib/control_meta";
import { capitalize, fmtDateTime } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { BookingEmailResult, VenueBooking } from "@/types/control_sourcing";

type Result = { booking: VenueBooking; email: BookingEmailResult };
type Fact = { label: string; value: string; icon: IconName; mono?: boolean };
type Tool = { key: string; icon: IconName; title: string; subtitle: string; onPress: () => void };

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function BookingScreen() {
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const path = `/api/control/sourcing/bookings/${id}`;
  const query = useControlQuery<{ booking: VenueBooking }>(path);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState(false);
  const booking = query.data?.booking;

  // Booking emails report per recipient; a toast says who got it, or why nobody did.
  const reportEmail = (email: BookingEmailResult) => {
    if (!email) return;
    if (email.ok) toast.success(`Emailed ${email.sent.filter((s) => s.status === "sent").map((s) => s.to).join(", ")}.`);
    else toast.error(`Email not sent: ${email.error || "unknown error"}`);
  };

  const act = async (key: string, url: string, body: unknown, message: string) => {
    setBusy(key);
    const res = await controlApi<Result>(url, { method: "POST", body });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      toast.error(res.error);
      return false;
    }
    successFeedback();
    query.setData({ booking: res.data.booking });
    toast.success(message);
    reportEmail(res.data.email);
    return true;
  };

  if (query.error && !booking) {
    return (
      <Screen scroll header={<ScreenHeader title="Booking" />}>
        <EmptyState icon="circle-alert" title="Couldn't open this booking" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      </Screen>
    );
  }
  if (!booking) {
    return (
      <Screen scroll header={<ScreenHeader title="Booking" />}>
        <SkeletonList rows={5} variant="card" />
      </Screen>
    );
  }

  const meta = BOOKING_STATUS[booking.displayStatus];
  const open = booking.status !== "cancelled" && booking.displayStatus !== "Completed";
  const date = venueDate(booking.startsAt, booking.timezone);
  const place = [booking.spaceName, booking.venueName].filter(Boolean).join(" · ");
  const resendTitle = booking.status === "hold" ? "Resend hold notice" : "Resend confirmation";

  const allFacts: (Fact | null)[] = [
    booking.eventName ? { label: "Event", value: booking.eventName, icon: "calendar" } : null,
    booking.setupStyle ? { label: "Setup", value: booking.setupStyle, icon: "layout-grid" } : null,
    booking.attendees ? { label: "Attendees", value: booking.attendees.toLocaleString("en-US"), icon: "users", mono: true } : null,
    { label: "Time zone", value: booking.timezone, icon: "globe", mono: true },
    booking.reference ? { label: "Reference", value: booking.reference, icon: "tag", mono: true } : null,
    booking.cancelReason ? { label: "Cancelled because", value: booking.cancelReason, icon: "ban" } : null,
  ];
  const facts = allFacts.filter((f): f is Fact => f !== null);

  const tools: Tool[] = [];
  if (open) {
    tools.push({
      key: "notify",
      icon: "mail",
      title: resendTitle,
      subtitle: "Emails the venue and the booker again",
      onPress: () => void act("notify", `${path}/notify`, { kind: booking.status === "hold" ? "hold" : "confirmation" }, "Email sent."),
    });
  }
  if (booking.calendarUrl) {
    tools.push({ key: "calendar", icon: "calendar-plus", title: "Add to calendar", subtitle: "Opens it in Google Calendar", onPress: () => void Linking.openURL(booking.calendarUrl) });
  }
  tools.push({ key: "edit", icon: "pencil", title: "Edit details", subtitle: "Title, contact and notes", onPress: () => setEditing(true) });

  let step = 0;

  return (
    <Screen scroll backdrop={<CoverWash numeral={eventDayNumeral(date)} />} header={<ScreenHeader title="Booking" />}>
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
          <View style={styles.heroTop}>
            <DateStub date={date} size="lg" muted={!open} />
            <View style={styles.heroWhen}>
              <Text style={styles.when} numberOfLines={2}>
                {booking.when}
              </Text>
              {place ? (
                <Text style={styles.place} numberOfLines={2}>
                  {place}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.name}>{booking.title || booking.spaceName}</Text>
          <View style={styles.metaRow}>
            <StatusButton label={meta.label} tone={meta.tone} />
            {booking.reference ? <Text style={styles.ref}>{booking.reference}</Text> : null}
            <Text style={styles.ref}>{booking.totalLabel}</Text>
          </View>
          {booking.liveHold && booking.holdExpiresAt ? (
            <View style={styles.notice}>
              <Icon name="timer" size={15} color={colors.warning} />
              <Text style={styles.noticeText}>{`Hold expires ${fmtDateTime(booking.holdExpiresAt)}. Confirm it to keep the slot.`}</Text>
            </View>
          ) : null}
        </Animated.View>

        {booking.liveHold ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Button
              title="Confirm booking"
              icon="circle-check"
              loading={busy === "confirm"}
              onPress={() => void act("confirm", `${path}/confirm`, {}, `${booking.reference} confirmed.`)}
              fullWidth
            />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Manage">
            {tools.map((tool, i) => {
              const sending = tool.key === "notify" && busy === "notify";
              return (
                <ListRow
                  key={tool.key}
                  leading={<IconTile icon={tool.icon} size={36} />}
                  title={tool.title}
                  subtitle={tool.subtitle}
                  trailing={sending ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : undefined}
                  onPress={sending ? undefined : tool.onPress}
                  divider={i < tools.length - 1}
                />
              );
            })}
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Price" footer="Priced from the space's published rates when it was booked.">
            {booking.priceLines.map((line, i) => (
              <LedgerRow key={line.date} label={line.date} detail={line.detail} amount={line.amount} divider={i < booking.priceLines.length - 1} />
            ))}
            <LedgerTotal
              label={booking.priceLines.length ? "Total" : "No charge"}
              amount={booking.totalLabel}
              hint={booking.currency ? booking.currency.toUpperCase() : undefined}
              ruled={booking.priceLines.length > 0}
            />
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Details">
            {facts.map((fact, i) => (
              <DetailRow key={fact.label} label={fact.label} value={fact.value} icon={fact.icon} mono={fact.mono} divider={i < facts.length - 1} />
            ))}
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Contact">
            <ListRow leading={<IconTile icon="users" size={36} />} title={booking.contactName || "No contact name"} subtitle="Name" />
            <ListRow
              leading={<IconTile icon="mail" size={36} />}
              title={booking.contactEmail || "No email"}
              subtitle="Email"
              onPress={booking.contactEmail ? () => void Linking.openURL(`mailto:${booking.contactEmail}`) : undefined}
            />
            <ListRow
              leading={<IconTile icon="smartphone" size={36} />}
              title={booking.contactPhone || "No phone"}
              subtitle="Phone"
              onPress={booking.contactPhone ? () => void Linking.openURL(`tel:${booking.contactPhone}`) : undefined}
              divider={false}
            />
          </ListGroup>
        </Animated.View>

        {booking.notes ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Notes">
              <Text style={styles.notes}>{booking.notes}</Text>
            </ListGroup>
          </Animated.View>
        ) : null}

        {booking.emails.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Email log">
              {booking.emails.map((e, i) => {
                const sent = e.status === "sent";
                return (
                  <ListRow
                    key={`${e.at}-${e.to}-${i}`}
                    leading={<IconTile icon={sent ? "mail-check" : "circle-alert"} size={36} tone={sent ? "success" : "warning"} />}
                    title={e.to}
                    subtitle={`${capitalize(e.kind)} · ${e.status} · ${fmtDateTime(e.at)}`}
                    divider={i < booking.emails.length - 1}
                  />
                );
              })}
            </ListGroup>
          </Animated.View>
        ) : null}

        {open ? <Button title="Cancel booking" icon="ban" variant="destructiveGhost" onPress={() => setCancelling(true)} fullWidth /> : null}
      </View>

      <Sheet visible={cancelling} onClose={() => setCancelling(false)} title={`Cancel ${booking.reference}?`}>
        <CancelForm
          busy={busy === "cancel"}
          onClose={() => setCancelling(false)}
          onCancel={async (reason, notify) => {
            const ok = await act("cancel", `${path}/cancel`, { reason, notify }, `${booking.reference} cancelled.`);
            if (ok) setCancelling(false);
          }}
        />
      </Sheet>

      <Sheet visible={editing} onClose={() => setEditing(false)} title="Booking details">
        <EditForm
          booking={booking}
          path={path}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setEditing(false);
            query.setData({ booking: next });
          }}
        />
      </Sheet>
    </Screen>
  );
}

function CancelForm({ busy, onClose, onCancel }: { busy: boolean; onClose: () => void; onCancel: (reason: string, notify: boolean) => void }) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Text style={styles.body}>The slot goes back on the calendar straight away.</Text>
        <Field label="Reason (optional)">
          <Input value={reason} onChangeText={setReason} placeholder="e.g. Event moved online" />
        </Field>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Email the venue and the booker</Text>
          <Switch value={notify} onValueChange={setNotify} label="Email the venue and the booker" />
        </View>
        <View style={styles.sheetActions}>
          <Button title="Keep it" variant="ghost" onPress={onClose} />
          <Button title="Cancel booking" variant="destructive" loading={busy} onPress={() => onCancel(reason, notify)} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function EditForm({ booking, path, onClose, onSaved }: { booking: VenueBooking; path: string; onClose: () => void; onSaved: (next: VenueBooking) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState({
    title: booking.title,
    contactName: booking.contactName,
    contactEmail: booking.contactEmail,
    contactPhone: booking.contactPhone,
    notes: booking.notes,
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setBusy(true);
    const res = await controlApi<{ booking: VenueBooking }>(path, { method: "PATCH", body: draft });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Saved.");
    onSaved(res.data.booking);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Text style={styles.body}>Time, space and price change only by cancelling and booking again.</Text>
        <Field label="Title">
          <Input value={draft.title} onChangeText={set("title")} />
        </Field>
        <Field label="Contact name">
          <Input value={draft.contactName} onChangeText={set("contactName")} />
        </Field>
        <Field label="Contact email">
          <Input value={draft.contactEmail} onChangeText={set("contactEmail")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Field label="Contact phone">
          <Input value={draft.contactPhone} onChangeText={set("contactPhone")} keyboardType="phone-pad" />
        </Field>
        <Field label="Notes">
          <Input value={draft.notes} onChangeText={set("notes")} multiline textAlignVertical="top" style={styles.multiline} />
        </Field>
        <View style={styles.sheetActions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Save" onPress={() => void save()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  heroWhen: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  when: {
    ...type.mono,
    color: colors.foreground,
  },
  place: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  name: {
    ...type.display,
    color: colors.foreground,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  ref: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: `${colors.warning}40`,
    borderRadius: radius.md,
    backgroundColor: `${colors.warning}12`,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  noticeText: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    color: colors.warning,
  },
  notes: {
    ...type.body,
    color: colors.mutedForeground,
    paddingVertical: spacing.md + 2,
  },
  form: {
    gap: spacing.lg,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
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
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  multiline: {
    minHeight: 90,
    paddingTop: spacing.md,
  },
});
