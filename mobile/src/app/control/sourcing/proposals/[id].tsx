import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { BID_STATUS, money, RECIPIENT_STATUS, RFP_STATUS, deadlineLabel } from "@/components/control/sourcing/meta";
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
import { fmtDate, fmtDateTime } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Rfp, RfpDetail, RfpRecipient } from "@/types/control_sourcing";

type Confirm = "send" | "remind" | "cancel" | "delete" | null;

const pad = (n: number) => String(n).padStart(2, "0");
const localStamp = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  return (
    <Screen scroll header={<ScreenHeader title="RFP" subtitle={meta.label} />}>
      <View style={styles.stack}>
        <Card>
          <View style={styles.head}>
            <Text style={styles.title}>{rfp.title || "Untitled RFP"}</Text>
            <Pill label={meta.label} tone={meta.tone} />
          </View>
          <Text style={styles.meta}>
            {[data.eventName, rfp.startDate ? `${fmtDate(rfp.startDate)}${rfp.endDate && rfp.endDate !== rfp.startDate ? ` – ${fmtDate(rfp.endDate)}` : ""}` : rfp.datesFlexible ? "Flexible dates" : "", rfp.attendees ? `${rfp.attendees.toLocaleString("en-US")} attendees` : "", rfp.location]
              .filter(Boolean)
              .join(" · ") || "No details yet"}
          </Text>
          <Text style={styles.meta}>{[budget ? `Budget ${budget}` : "", `Responses: ${deadlineLabel(rfp.responseDeadline)}`].filter(Boolean).join(" · ")}</Text>
          {rfp.summary ? <Text style={styles.summary}>{rfp.summary}</Text> : null}
        </Card>

        {rfp.status === "draft" && data.readiness.length ? (
          <Card tone="subtle">
            <Text style={styles.label}>Before it can go out</Text>
            {data.readiness.map((issue) => (
              <Text key={issue} style={styles.meta}>
                {`• ${issue}`}
              </Text>
            ))}
            {!data.hasRequirements ? <Text style={styles.hint}>Meeting-space and sleeping-room tables are set on the dashboard; F&B and AV needs can be added here.</Text> : null}
          </Card>
        ) : null}

        <View style={styles.actions}>
          {rfp.status === "draft" ? (
            <>
              <Button title="Edit brief" icon="pencil" variant="secondary" onPress={() => setEditing(true)} />
              <Button title="Send to venues" icon="send" onPress={() => setConfirm("send")} disabled={!unsent || data.readiness.length > 0} />
            </>
          ) : null}
          {rfp.status === "sent" ? (
            <>
              {unsent ? <Button title={`Invite ${unsent} new`} icon="send" onPress={() => setConfirm("send")} /> : null}
              <Button title="Remind" icon="bell" variant="secondary" onPress={() => setConfirm("remind")} disabled={!waiting} />
              <Button title="Close bidding" icon="lock" variant="secondary" loading={busy === "closed"} onPress={() => void setStatus("closed", "Bidding closed.")} />
            </>
          ) : null}
          {rfp.status === "closed" ? (
            <Button title="Reopen bidding" icon="rotate-ccw" variant="secondary" loading={busy === "sent"} onPress={() => void setStatus("sent", "Bidding reopened.")} />
          ) : null}
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
        </View>

        <View>
          <SectionTitle
            action={!final ? <Button title="Add venue" icon="plus" size="sm" variant="secondary" onPress={() => setAdding(true)} /> : undefined}
          >
            Venues
          </SectionTitle>
          {data.recipients.length ? (
            <View style={styles.group}>
              {data.recipients.map((r, i) => {
                const status = RECIPIENT_STATUS[r.status];
                return (
                  <ListRow
                    key={r.id}
                    leading={<IconTile icon="building-2" size={34} tone={r.status === "awarded" ? "success" : "neutral"} />}
                    title={r.name || "Venue"}
                    subtitle={[r.bid ? `${money(r.bid.total, r.bid.currency)} · ${BID_STATUS[r.bid.status].label}` : "", r.email].filter(Boolean).join(" · ")}
                    trailing={<Pill label={status.label} tone={status.tone} variant="outline" />}
                    onPress={() => setVenue(r)}
                    divider={i < data.recipients.length - 1}
                  />
                );
              })}
            </View>
          ) : (
            <Card tone="subtle">
              <Text style={styles.meta}>No venues yet. Add the venues you want bids from; the dashboard can also add them from your venue book or sourcing pipeline.</Text>
            </Card>
          )}
        </View>

        {!final ? <Button title="Cancel RFP" icon="ban" variant="destructiveGhost" onPress={() => setConfirm("cancel")} fullWidth /> : null}
        <Button title="Delete RFP" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirm("delete")} fullWidth />
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
          <View style={styles.row}>
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
          <View style={styles.row}>
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
          <View style={styles.row}>
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
        {hasEvent ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Set it as the event&apos;s venue</Text>
            <Switch value={linkEvent} onValueChange={setLinkEvent} label="Set it as the event's venue" />
          </View>
        ) : null}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Email the award and regret notices</Text>
          <Switch value={notify} onValueChange={setNotify} label="Email the award and regret notices" />
        </View>
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
      <View style={styles.facts}>
        {venue.contactName ? <Text style={styles.meta}>{venue.contactName}</Text> : null}
        {venue.email ? (
          <Text style={styles.link} onPress={() => void Linking.openURL(`mailto:${venue.email}`)} accessibilityRole="link">
            {venue.email}
          </Text>
        ) : (
          <Text style={styles.hint}>{"No email — they can't be sent a link until one is added on the dashboard."}</Text>
        )}
        {venue.invitedAt ? <Text style={styles.hint}>{`Invited ${fmtDateTime(venue.invitedAt)}`}</Text> : null}
        {venue.declineReason ? <Text style={styles.hint}>{`Declined: ${venue.declineReason}`}</Text> : null}
      </View>
      {bid ? (
        <Card tone="subtle">
          <Text style={styles.label}>{`Bid · ${money(bid.total, bid.currency)}`}</Text>
          <Text style={styles.meta}>
            {[BID_STATUS[bid.status].label, bid.revision > 1 ? `Revision ${bid.revision}` : "", bid.capacity ? `Holds ${bid.capacity}` : "", bid.validUntil ? `Valid to ${fmtDate(bid.validUntil)}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {bid.message ? <Text style={styles.summary}>{bid.message}</Text> : null}
          <Text style={styles.hint}>Line items and the side-by-side comparison are on the dashboard.</Text>
        </Card>
      ) : (
        <Text style={styles.hint}>No bid yet.</Text>
      )}
      {bid && !final && bid.status !== "awarded" ? (
        <View style={styles.actions}>
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
  summary: {
    ...type.body,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  label: {
    ...type.labelStrong,
    color: colors.foreground,
  },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  link: {
    ...type.body,
    color: colors.info,
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
  sheet: {
    gap: spacing.lg,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  facts: {
    gap: 2,
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
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  formScroll: {
    maxHeight: 560,
  },
  row: {
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
