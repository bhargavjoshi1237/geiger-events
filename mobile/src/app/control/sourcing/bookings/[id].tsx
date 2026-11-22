import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, View } from "react-native";

import { BOOKING_STATUS } from "@/components/control/sourcing/meta";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDateTime } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { BookingEmailResult, VenueBooking } from "@/types/control_sourcing";

type Result = { booking: VenueBooking; email: BookingEmailResult };

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

  return (
    <Screen scroll header={<ScreenHeader title={booking.reference || "Booking"} subtitle={meta.label} />}>
      <View style={styles.stack}>
        <Card>
          <View style={styles.head}>
            <Text style={styles.title}>{booking.title || booking.spaceName}</Text>
            <Pill label={meta.label} tone={meta.tone} />
          </View>
          <Text style={styles.meta}>{booking.when}</Text>
          <Text style={styles.meta}>{[booking.spaceName, booking.venueName].filter(Boolean).join(", ")}</Text>
          {booking.eventName ? <Text style={styles.meta}>{`For ${booking.eventName}`}</Text> : null}
          {booking.setupStyle || booking.attendees ? (
            <Text style={styles.meta}>{[booking.setupStyle, booking.attendees ? `${booking.attendees} people` : ""].filter(Boolean).join(" · ")}</Text>
          ) : null}
          {booking.liveHold && booking.holdExpiresAt ? <Text style={styles.warn}>{`Hold expires ${fmtDateTime(booking.holdExpiresAt)}`}</Text> : null}
          {booking.cancelReason ? <Text style={styles.meta}>{`Cancelled: ${booking.cancelReason}`}</Text> : null}
        </Card>

        <View style={styles.actions}>
          {booking.liveHold ? (
            <Button
              title="Confirm booking"
              icon="circle-check"
              loading={busy === "confirm"}
              onPress={() => void act("confirm", `${path}/confirm`, {}, `${booking.reference} confirmed.`)}
            />
          ) : null}
          {open ? (
            <Button
              title={booking.status === "hold" ? "Resend hold notice" : "Resend confirmation"}
              icon="mail"
              variant="secondary"
              loading={busy === "notify"}
              onPress={() => void act("notify", `${path}/notify`, { kind: booking.status === "hold" ? "hold" : "confirmation" }, "Email sent.")}
            />
          ) : null}
          {booking.calendarUrl ? (
            <Button title="Add to calendar" icon="calendar" variant="ghost" onPress={() => void Linking.openURL(booking.calendarUrl)} />
          ) : null}
          <Button title="Edit details" icon="pencil" variant="ghost" onPress={() => setEditing(true)} />
        </View>

        <View>
          <SectionTitle>{`Price · ${booking.totalLabel}`}</SectionTitle>
          <View style={styles.group}>
            {booking.priceLines.length ? (
              booking.priceLines.map((line, i) => (
                <ListRow key={line.date} title={`${line.date} · ${line.amount}`} subtitle={line.detail} divider={i < booking.priceLines.length - 1} />
              ))
            ) : (
              <ListRow title="No charge" divider={false} />
            )}
          </View>
        </View>

        <View>
          <SectionTitle>Contact</SectionTitle>
          <View style={styles.group}>
            <ListRow leading={<IconTile icon="users" size={34} />} title={booking.contactName || "No contact name"} subtitle="Name" />
            <ListRow
              leading={<IconTile icon="mail" size={34} />}
              title={booking.contactEmail || "No email"}
              subtitle="Email"
              onPress={booking.contactEmail ? () => void Linking.openURL(`mailto:${booking.contactEmail}`) : undefined}
            />
            <ListRow
              leading={<IconTile icon="smartphone" size={34} />}
              title={booking.contactPhone || "No phone"}
              subtitle="Phone"
              onPress={booking.contactPhone ? () => void Linking.openURL(`tel:${booking.contactPhone}`) : undefined}
              divider={false}
            />
          </View>
          {booking.notes ? <Text style={styles.notes}>{booking.notes}</Text> : null}
        </View>

        {booking.emails.length ? (
          <View>
            <SectionTitle>Emails</SectionTitle>
            <View style={styles.group}>
              {booking.emails.map((e, i) => (
                <ListRow key={`${e.at}-${e.to}-${i}`} title={`${e.kind} · ${e.to}`} subtitle={`${e.status} · ${fmtDateTime(e.at)}`} divider={i < booking.emails.length - 1} />
              ))}
            </View>
          </View>
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
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    ...type.title,
    flex: 1,
    color: colors.foreground,
  },
  meta: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  warn: {
    ...type.label,
    color: colors.warning,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  notes: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
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
