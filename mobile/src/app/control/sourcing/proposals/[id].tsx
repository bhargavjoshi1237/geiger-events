import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { CoverWash } from "@/components/control/CoverWash";
import { DateStub } from "@/components/control/DateStub";
import { LedgerTotal } from "@/components/control/sourcing/Ledger";
import { BID_STATUS, money, RECIPIENT_STATUS, RFP_STATUS, deadlineLabel } from "@/components/control/sourcing/meta";
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
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { TickMeter } from "@/components/ui/TickMeter";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { eventDayNumeral } from "@/lib/control_meta";
import { fmtDate, fmtDateTime, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, spacing, type } from "@/theme/tokens";
import type { Rfp, RfpDetail, RfpRecipient } from "@/types/control_sourcing";

type Confirm = "send" | "remind" | "cancel" | "delete" | null;
type Fact = { label: string; value: string; icon: IconName; mono?: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const localStamp = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const stagger = (i: number) => Math.min(i, 8) * 50;

// Brief dates are calendar days; read them as local so they agree with the date stub.
const calendarDay = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : fmtDate(d);
};

export default function ProposalScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const path = `/api/control/sourcing/rfps/${id}`;
  const query = useControlQuery<RfpDetail>(path);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [venue, setVenue] = useState<RfpRecipient | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const data = query.data;
  const rfp = data?.rfp;
  const final = rfp ? rfp.status === "awarded" || rfp.status === "cancelled" : false;

  const call = async <T,>(key: string, url: string, init: { method: string; body?: unknown }, done: (value: T) => void) => {
    setBusy(key);
    const res = await controlApi<T>(url, init);
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      toast.error(res.error);
      return false;
    }
    successFeedback();
    done(res.data);
    return true;
  };

  const setStatus = (status: "closed" | "sent" | "cancelled", message: string) =>
    call<RfpDetail>(status, path, { method: "PATCH", body: { status } }, (next) => {
      query.setData(next);
      toast.success(message);
    });

  const send = (mode: "invite" | "reminder") =>
    call<{ emailed: number; attempted: number; skipped: number }>(mode, `${path}/send`, { method: "POST", body: { mode } }, (res) => {
      toast.success(
        res.emailed === res.attempted
          ? `Emailed ${res.emailed} venue${res.emailed === 1 ? "" : "s"}.`
          : `Emailed ${res.emailed} of ${res.attempted}; the rest have their links but the email didn't go.`,
      );
      void query.reload();
    });

  if (query.error && !data) {
    return (
      <Screen scroll header={<ScreenHeader title="RFP" />}>
        <EmptyState icon="circle-alert" title="Couldn't open this RFP" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      </Screen>
    );
  }
  if (!data || !rfp) {
    return (
      <Screen scroll header={<ScreenHeader title="RFP" />}>
        <SkeletonList rows={5} variant="card" />
      </Screen>
    );
  }

  const meta = RFP_STATUS[rfp.status];
  const unsent = data.recipients.filter((r) => r.status === "pending" && r.email).length;
  const waiting = data.recipients.filter((r) => r.status === "invited" || r.status === "viewed").length;
  const budget = rfp.budgetMin != null || rfp.budgetMax != null ? `${money(rfp.budgetMin, rfp.currency)} – ${money(rfp.budgetMax, rfp.currency)}` : "";
  const invited = data.recipients.filter((r) => r.status !== "pending").length;
  const bids = data.recipients.flatMap((r) => (r.bid ? [r.bid] : []));
  const live = bids.filter((b) => b.status !== "rejected");
  const best = live.length ? live.reduce((low, b) => (b.total < low.total ? b : low)) : null;
  const deadline = deadlineLabel(rfp.responseDeadline);
  const late = rfp.status === "sent" && (deadline.startsWith("Deadline passed") || deadline === "Due today");
  const dates = rfp.startDate
    ? `${calendarDay(rfp.startDate)}${rfp.endDate && rfp.endDate !== rfp.startDate ? ` – ${calendarDay(rfp.endDate)}` : ""}`
    : rfp.datesFlexible
      ? "Flexible dates"
      : "No dates yet";
  const context = [data.eventName, rfp.location].filter(Boolean).join(" · ");

  const allFacts: (Fact | null)[] = [
    { label: "Dates", value: `${dates}${rfp.startDate && rfp.datesFlexible ? " · flexible" : ""}`, icon: "calendar" },
    rfp.attendees ? { label: "Attendees", value: rfp.attendees.toLocaleString("en-US"), icon: "users", mono: true } : null,
    rfp.location ? { label: "Location", value: rfp.location, icon: "map-pin" } : null,
    { label: "Budget", value: budget || "Not set", icon: "wallet", mono: Boolean(budget) },
    rfp.responseDeadline ? { label: "Responses by", value: fmtDateTime(rfp.responseDeadline), icon: "clock", mono: true } : null,
    rfp.decisionDate ? { label: "Decision", value: calendarDay(rfp.decisionDate), icon: "calendar-check", mono: true } : null,
    rfp.sentAt ? { label: "Sent", value: fmtDateTime(rfp.sentAt), icon: "send", mono: true } : null,
    rfp.awardedAt ? { label: "Awarded", value: fmtDateTime(rfp.awardedAt), icon: "award", mono: true } : null,
  ];
  const facts = allFacts.filter((f): f is Fact => f !== null);
  const requirements = [
    { label: "Food & drink", text: rfp.fnbRequirements },
    { label: "AV needs", text: rfp.avNeeds },
    { label: "Notes for venues", text: rfp.notes },
  ].filter((r) => r.text.trim());

  const duplicate = (
    <Button
      title="Duplicate"
      icon="copy"
      variant="ghost"
      loading={busy === "dup"}
      onPress={() =>
        void call<{ rfp: Rfp }>("dup", `${path}/duplicate`, { method: "POST" }, (res) => {
          toast.success("Duplicated as a new draft — venues and bids aren't copied.");
          router.replace({ pathname: "/control/sourcing/proposals/[id]", params: { id: res.rfp.id } });
        })
      }
    />
  );

  let step = 0;

  return (
    <Screen scroll backdrop={<CoverWash numeral={eventDayNumeral(rfp.startDate || null)} />} header={<ScreenHeader title="RFP" />}>
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.hero}>
          <View style={styles.heroTop}>
            {rfp.startDate ? <DateStub date={rfp.startDate} size="lg" muted={final} /> : <IconTile icon="file-text" size={56} />}
            <View style={styles.heroWhen}>
              <Text style={styles.when} numberOfLines={2}>
                {dates}
              </Text>
              {context ? (
                <Text style={styles.place} numberOfLines={2}>
                  {context}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.name}>{rfp.title || "Untitled RFP"}</Text>
          <View style={styles.metaRow}>
            <StatusButton label={meta.label} tone={meta.tone} />
            {rfp.attendees ? <Text style={styles.fact}>{`${rfp.attendees.toLocaleString("en-US")} pax`}</Text> : null}
            {rfp.status === "sent" ? <Text style={[styles.fact, late && styles.late]}>{deadline}</Text> : null}
          </View>
          {rfp.summary ? <Text style={styles.summary}>{rfp.summary}</Text> : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Readout
            lead={{ label: "Bids in", value: String(bids.length), hint: invited ? `of ${invited} invited` : "none invited yet" }}
            items={[
              { label: "Best bid", value: best ? money(best.total, best.currency) : "—" },
              { label: "Budget", value: budget || "Not set" },
              { label: "Responses", value: rfp.responseDeadline ? deadline.replace("Deadline passed", "Passed") : "Open", tone: late ? "warning" : "neutral" },
            ]}
          >
            {invited ? <TickMeter value={bids.length} max={invited} ticks={44} height={16} tone="info" label={`${bids.length} of ${invited} invited venues bid`} /> : null}
          </Readout>
        </Animated.View>

        {rfp.status === "draft" && data.readiness.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup
              title="Before it can go out"
              footer={data.hasRequirements ? undefined : "Meeting-space and sleeping-room tables are set on the dashboard; F&B and AV needs can be added here."}
            >
              {data.readiness.map((issue, i) => (
                <View key={issue} style={[styles.issue, i < data.readiness.length - 1 && styles.divided]}>
                  <Icon name="circle-alert" size={16} color={colors.warning} />
                  <Text style={styles.issueText}>{issue}</Text>
                </View>
              ))}
            </ListGroup>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()} style={styles.actions}>
          {rfp.status === "draft" ? (
            <>
              <Button title="Send to venues" icon="send" onPress={() => setConfirm("send")} disabled={!unsent || data.readiness.length > 0} fullWidth />
              <View style={styles.actionRow}>
                <Button title="Edit brief" icon="pencil" variant="secondary" onPress={() => setEditing(true)} />
                {duplicate}
              </View>
            </>
          ) : null}
          {rfp.status === "sent" ? (
            <>
              {unsent ? <Button title={`Invite ${unsent} new`} icon="send" onPress={() => setConfirm("send")} fullWidth /> : null}
              <View style={styles.actionRow}>
                <Button title="Remind" icon="bell" variant="secondary" onPress={() => setConfirm("remind")} disabled={!waiting} />
                <Button title="Close bidding" icon="lock" variant="secondary" loading={busy === "closed"} onPress={() => void setStatus("closed", "Bidding closed.")} />
                {duplicate}
              </View>
            </>
          ) : null}
          {rfp.status === "closed" ? (
            <View style={styles.actionRow}>
              <Button title="Reopen bidding" icon="rotate-ccw" variant="secondary" loading={busy === "sent"} onPress={() => void setStatus("sent", "Bidding reopened.")} />
              {duplicate}
            </View>
          ) : null}
          {final ? <View style={styles.actionRow}>{duplicate}</View> : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup
            title={data.recipients.length ? `${data.recipients.length} ${pluralize(data.recipients.length, "venue", "venues")}` : "Venues"}
            action={!final ? <Button title="Add venue" icon="plus" size="sm" variant="secondary" onPress={() => setAdding(true)} /> : undefined}
            footer={bids.length ? "Line items and the side-by-side comparison are on the dashboard." : undefined}
          >
            {data.recipients.length ? (
              data.recipients.map((r, i) => <VenueRow key={r.id} venue={r} onPress={() => setVenue(r)} divider={i < data.recipients.length - 1} />)
            ) : (
              <Text style={styles.empty}>No venues yet. Add the venues you want bids from; the dashboard can also add them from your venue book or sourcing pipeline.</Text>
            )}
          </ListGroup>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Brief">
            {facts.map((fact, i) => (
              <DetailRow key={fact.label} label={fact.label} value={fact.value} icon={fact.icon} mono={fact.mono} divider={i < facts.length - 1} />
            ))}
          </ListGroup>
        </Animated.View>

        {requirements.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Requirements">
              {requirements.map((r, i) => (
                <View key={r.label} style={[styles.para, i < requirements.length - 1 && styles.divided]}>
                  <Text style={styles.paraLabel}>{r.label}</Text>
                  <Text style={styles.paraText}>{r.text}</Text>
                </View>
              ))}
            </ListGroup>
          </Animated.View>
        ) : null}

        <View style={styles.danger}>
          {!final ? <Button title="Cancel RFP" icon="ban" variant="destructiveGhost" onPress={() => setConfirm("cancel")} fullWidth /> : null}
          <Button title="Delete RFP" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirm("delete")} fullWidth />
        </View>
      </View>

      <Sheet visible={confirm !== null} onClose={() => setConfirm(null)} title={CONFIRM_TITLE[confirm ?? "send"]}>
        <View style={styles.sheet}>
          <Text style={styles.body}>
            {confirm === "send"
              ? `Each of the ${unsent} venue${unsent === 1 ? "" : "s"} not yet invited gets an email with a private link to bid. ${rfp.status === "draft" ? "The brief locks once it goes out." : ""}`
              : confirm === "remind"
                ? `The ${waiting} venue${waiting === 1 ? "" : "s"} still deciding get a reminder with a fresh link.`
                : confirm === "cancel"
                  ? "Venues can no longer bid, and their links show the RFP as cancelled."
                  : "Every venue link stops working. This can't be undone."}
          </Text>
          <View style={styles.sheetActions}>
            <Button title="Keep it" variant="ghost" onPress={() => setConfirm(null)} />
            <Button
              title={CONFIRM_ACTION[confirm ?? "send"]}
              variant={confirm === "cancel" || confirm === "delete" ? "destructive" : "primary"}
              loading={busy !== null}
              onPress={() => {
                const which = confirm;
                setConfirm(null);
                if (which === "send") void send("invite");
                else if (which === "remind") void send("reminder");
                else if (which === "cancel") void setStatus("cancelled", "RFP cancelled.");
                else if (which === "delete")
                  void call<{ deleted: boolean }>("delete", path, { method: "DELETE" }, () => {
                    toast.success("RFP deleted.");
                    router.back();
                  });
              }}
            />
          </View>
        </View>
      </Sheet>

      <Sheet visible={editing} onClose={() => setEditing(false)} title="Edit brief">
        <BriefForm
          rfp={rfp}
          path={path}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setEditing(false);
            query.setData(next);
          }}
        />
      </Sheet>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add venue">
        <AddVenue
          path={path}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void query.reload();
          }}
        />
      </Sheet>

      <Sheet visible={venue !== null} onClose={() => setVenue(null)} title={venue?.name || "Venue"}>
        {venue ? (
          <VenueSheet
            rfp={rfp}
            venue={venue}
            hasEvent={Boolean(rfp.eventId)}
            onChanged={(message) => {
              setVenue(null);
              toast.success(message);
              void query.reload();
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const CONFIRM_TITLE: Record<Exclude<Confirm, null>, string> = {
  send: "Send the RFP?",
  remind: "Send reminders?",
  cancel: "Cancel this RFP?",
  delete: "Delete this RFP?",
};
const CONFIRM_ACTION: Record<Exclude<Confirm, null>, string> = {
  send: "Send",
  remind: "Send reminders",
  cancel: "Cancel RFP",
  delete: "Delete",
};

// A venue on the RFP as a ledger line: who they are and where they stand, their bid right-aligned in mono.
function VenueRow({ venue: r, onPress, divider }: { venue: RfpRecipient; onPress: () => void; divider: boolean }) {
  const status = RECIPIENT_STATUS[r.status];
  const contact = [r.contactName, r.email].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.name || "Venue"}, ${status.label}${r.bid ? `, bid ${money(r.bid.total, r.bid.currency)}` : ""}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.venue, divider && styles.divided, pressed && styles.pressed]}
    >
      <IconTile icon={r.status === "awarded" ? "award" : "building-2"} size={36} tone={r.status === "awarded" ? "success" : r.status === "declined" ? "outline" : "neutral"} />
      <View style={styles.venueText}>
        <Text style={styles.venueName} numberOfLines={1}>
          {r.name || "Venue"}
        </Text>
        <View style={styles.venueMeta}>
          <Pill label={status.label} tone={status.tone} variant="outline" />
          {contact ? (
            <Text style={styles.venueContact} numberOfLines={1}>
              {contact}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.bid}>
        {r.bid ? (
          <>
            <Text style={[styles.bidAmount, r.bid.status === "rejected" && styles.bidStruck]} numberOfLines={1}>
              {money(r.bid.total, r.bid.currency)}
            </Text>
            <Text style={styles.bidStatus} numberOfLines={1}>
              {BID_STATUS[r.bid.status].label}
            </Text>
          </>
        ) : (
          <Text style={styles.noBid}>No bid</Text>
        )}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function BriefForm({ rfp, path, onClose, onSaved }: { rfp: Rfp; path: string; onClose: () => void; onSaved: (next: RfpDetail) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState({
    title: rfp.title,
    summary: rfp.summary,
    startDate: rfp.startDate,
    endDate: rfp.endDate,
    attendees: rfp.attendees ? String(rfp.attendees) : "",
    location: rfp.location,
    fnbRequirements: rfp.fnbRequirements,
    avNeeds: rfp.avNeeds,
    budgetMin: rfp.budgetMin == null ? "" : String(rfp.budgetMin),
    budgetMax: rfp.budgetMax == null ? "" : String(rfp.budgetMax),
    deadline: localStamp(rfp.responseDeadline),
    decisionDate: rfp.decisionDate,
    notes: rfp.notes,
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(draft.deadline.trim());
    if (draft.deadline.trim() && !m) return toast.error("Write the deadline as YYYY-MM-DD HH:MM.");
    const body = {
      title: draft.title,
      summary: draft.summary,
      startDate: draft.startDate,
      endDate: draft.endDate,
      attendees: draft.attendees.trim() ? Number(draft.attendees) : 0,
      location: draft.location,
      fnbRequirements: draft.fnbRequirements,
      avNeeds: draft.avNeeds,
      budgetMin: draft.budgetMin,
      budgetMax: draft.budgetMax,
      responseDeadline: m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).toISOString() : null,
      decisionDate: draft.decisionDate,
      notes: draft.notes,
    };
    setBusy(true);
    const res = await controlApi<RfpDetail>(path, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Brief saved.");
    onSaved(res.data);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Field label="Title">
            <Input value={draft.title} onChangeText={set("title")} />
          </Field>
          <Field label="Summary">
            <Input value={draft.summary} onChangeText={set("summary")} multiline textAlignVertical="top" style={styles.multiline} />
          </Field>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="Start date">
                <Input value={draft.startDate} onChangeText={set("startDate")} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="End date">
                <Input value={draft.endDate} onChangeText={set("endDate")} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
              </Field>
            </View>
          </View>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="Attendees">
                <Input value={draft.attendees} onChangeText={set("attendees")} keyboardType="number-pad" />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="Location">
                <Input value={draft.location} onChangeText={set("location")} />
              </Field>
            </View>
          </View>
          <Field label="Food & drink">
            <Input value={draft.fnbRequirements} onChangeText={set("fnbRequirements")} multiline textAlignVertical="top" style={styles.multiline} />
          </Field>
          <Field label="AV needs">
            <Input value={draft.avNeeds} onChangeText={set("avNeeds")} multiline textAlignVertical="top" style={styles.multiline} />
          </Field>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label={`Budget min (${rfp.currency})`}>
                <Input value={draft.budgetMin} onChangeText={set("budgetMin")} keyboardType="decimal-pad" />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label={`Budget max (${rfp.currency})`}>
                <Input value={draft.budgetMax} onChangeText={set("budgetMax")} keyboardType="decimal-pad" />
              </Field>
            </View>
          </View>
          <Field label="Response deadline" hint="Your local time, as YYYY-MM-DD HH:MM.">
            <Input value={draft.deadline} onChangeText={set("deadline")} placeholder="2026-12-06 17:00" keyboardType="numbers-and-punctuation" />
          </Field>
          <Field label="Decision date">
            <Input value={draft.decisionDate} onChangeText={set("decisionDate")} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          </Field>
          <Field label="Notes for venues">
            <Input value={draft.notes} onChangeText={set("notes")} multiline textAlignVertical="top" style={styles.multiline} />
          </Field>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Button title="Save brief" onPress={() => void save()} loading={busy} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AddVenue({ path, onClose, onAdded }: { path: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return toast.error("Name the venue.");
    setBusy(true);
    const res = await controlApi<{ recipient: unknown }>(`${path}/recipients`, { method: "POST", body: { name, contactName, email } });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(`${name.trim()} added. Send the RFP to email their link.`);
    onAdded();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Field label="Venue">
          <Input value={name} onChangeText={setName} placeholder="e.g. The Grand Hall" />
        </Field>
        <Field label="Contact name">
          <Input value={contactName} onChangeText={setContactName} />
        </Field>
        <Field label="Email" hint="Where their private bid link is sent.">
          <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="events@venue.com" />
        </Field>
        <View style={styles.sheetActions}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Add venue" onPress={() => void add()} loading={busy} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// One venue: its bid, the dashboard's shortlist / reject / award moves, and removal.
function VenueSheet({ rfp, venue, hasEvent, onChanged }: { rfp: Rfp; venue: RfpRecipient; hasEvent: boolean; onChanged: (message: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [linkEvent, setLinkEvent] = useState(true);
  const [notify, setNotify] = useState(true);
  const bid = venue.bid;
  const final = rfp.status === "awarded" || rfp.status === "cancelled";
  const canAward = Boolean(bid) && (rfp.status === "sent" || rfp.status === "closed") && venue.status !== "declined" && bid?.status !== "rejected";
  const status = RECIPIENT_STATUS[venue.status];

  const run = async (key: string, url: string, init: { method: string; body?: unknown }, message: string) => {
    setBusy(key);
    const res = await controlApi<Record<string, unknown>>(url, init);
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    onChanged(message);
  };

  if (awarding && bid) {
    return (
      <View style={styles.sheet}>
        <Text style={styles.body}>{`Award ${venue.name} at ${money(bid.total, bid.currency)}? The RFP closes, the venue joins your venue book, and the other venues are marked not selected.`}</Text>
        <ListGroup>
          {hasEvent ? (
            <ListRow
              leading={<IconTile icon="calendar" size={32} />}
              title="Set it as the event's venue"
              trailing={<Switch value={linkEvent} onValueChange={setLinkEvent} label="Set it as the event's venue" />}
            />
          ) : null}
          <ListRow
            leading={<IconTile icon="mail" size={32} />}
            title="Email the award and regret notices"
            trailing={<Switch value={notify} onValueChange={setNotify} label="Email the award and regret notices" />}
            divider={false}
          />
        </ListGroup>
        <View style={styles.sheetActions}>
          <Button title="Back" variant="ghost" onPress={() => setAwarding(false)} />
          <Button
            title="Award"
            icon="award"
            loading={busy === "award"}
            onPress={() => void run("award", `/api/control/sourcing/bids/${bid.id}/award`, { method: "POST", body: { linkEvent, notify } }, `${venue.name} awarded.`)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHead}>
        <StatusButton label={status.label} tone={status.tone} />
        {venue.invitedAt ? <Text style={styles.fact}>{`Invited ${fmtDateTime(venue.invitedAt)}`}</Text> : null}
      </View>
      <ListGroup>
        {venue.contactName ? <ListRow leading={<IconTile icon="users" size={32} />} title={venue.contactName} subtitle="Contact" /> : null}
        {venue.email ? (
          <ListRow leading={<IconTile icon="mail" size={32} />} title={venue.email} subtitle="Email" onPress={() => void Linking.openURL(`mailto:${venue.email}`)} divider={false} />
        ) : (
          <ListRow leading={<IconTile icon="mail" size={32} tone="warning" />} title="No email" subtitle="They can't be sent a link until one is added on the dashboard." divider={false} />
        )}
      </ListGroup>
      {venue.declineReason ? <Text style={styles.hint}>{`Declined: ${venue.declineReason}`}</Text> : null}
      {bid ? (
        <ListGroup title="Bid" footer="Line items and the side-by-side comparison are on the dashboard.">
          <LedgerTotal
            label={BID_STATUS[bid.status].label}
            amount={money(bid.total, bid.currency)}
            hint={[bid.revision > 1 ? `Revision ${bid.revision}` : "", bid.capacity ? `Holds ${bid.capacity}` : "", bid.validUntil ? `Valid to ${fmtDate(bid.validUntil)}` : ""].filter(Boolean).join(" · ") || undefined}
            ruled={false}
          />
          {bid.message ? <Text style={styles.bidMessage}>{bid.message}</Text> : null}
        </ListGroup>
      ) : (
        <Text style={styles.hint}>No bid yet.</Text>
      )}
      {bid && !final && bid.status !== "awarded" ? (
        <View style={styles.actionRow}>
          {bid.status !== "shortlisted" ? (
            <Button title="Shortlist" variant="secondary" loading={busy === "shortlisted"} onPress={() => void run("shortlisted", `/api/control/sourcing/bids/${bid.id}`, { method: "PATCH", body: { status: "shortlisted" } }, "Shortlisted.")} />
          ) : null}
          {bid.status !== "rejected" ? (
            <Button title="Reject" variant="ghost" loading={busy === "rejected"} onPress={() => void run("rejected", `/api/control/sourcing/bids/${bid.id}`, { method: "PATCH", body: { status: "rejected" } }, "Bid rejected.")} />
          ) : (
            <Button title="Restore" variant="ghost" loading={busy === "submitted"} onPress={() => void run("submitted", `/api/control/sourcing/bids/${bid.id}`, { method: "PATCH", body: { status: "submitted" } }, "Bid restored.")} />
          )}
          {canAward ? <Button title="Award…" icon="award" onPress={() => setAwarding(true)} /> : null}
        </View>
      ) : null}
      {!final ? (
        <Button
          title="Remove venue"
          icon="trash-2"
          variant="destructiveGhost"
          loading={busy === "remove"}
          onPress={() => void run("remove", `/api/control/sourcing/recipients/${venue.id}`, { method: "DELETE" }, `${venue.name} removed; their link no longer works.`)}
        />
      ) : null}
    </View>
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
    ...type.title,
    color: colors.foreground,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  fact: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  late: {
    color: colors.warning,
  },
  summary: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  issue: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
  },
  issueText: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    color: colors.foreground,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  actions: {
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  venue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
  },
  venueText: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  venueName: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  venueMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  venueContact: {
    ...type.caption,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  bid: {
    alignItems: "flex-end",
    gap: 2,
    maxWidth: "38%",
  },
  bidAmount: {
    ...type.mono,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  bidStruck: {
    color: colors.textTertiary,
    textDecorationLine: "line-through",
  },
  bidStatus: {
    ...type.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  noBid: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
  },
  empty: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  para: {
    gap: spacing.xs,
    paddingVertical: spacing.md + 2,
  },
  paraLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  paraText: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  danger: {
    gap: spacing.xs,
  },
  sheet: {
    gap: spacing.lg,
  },
  sheetHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
  },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
  },
  bidMessage: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    paddingBottom: spacing.md + 2,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  formScroll: {
    maxHeight: 560,
  },
  pair: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  multiline: {
    minHeight: 90,
    paddingTop: spacing.md,
  },
});
