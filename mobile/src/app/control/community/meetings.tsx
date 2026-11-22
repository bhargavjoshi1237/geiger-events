import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Byline } from "@/components/control/community/Byline";
import { MEETING_STATUS_META, REQUEST_STATUS_META } from "@/components/control/community/meta";
import { DateStub } from "@/components/control/DateStub";
import { StatusButton } from "@/components/control/StatusButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtClock, fmtTimeAgo, isToday, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { CommunityMeeting, CommunityMeetingRequest, CommunityMeetings, MeetingStatus } from "@/types/control_community";
import type { ControlEvent } from "@/types/portal";

const pad = (n: number) => String(n).padStart(2, "0");
const stagger = (i: number) => Math.min(i, 8) * 50;

// The meeting's calendar day on this phone, for the date stub.
function localDay(iso: string | null): string | null {
  const d = new Date(iso ?? "");
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "09:30 – 10:00", or just the start when the end isn't known.
function timeRange(m: CommunityMeeting): string {
  const start = fmtClock(m.startsAt);
  const end = fmtClock(m.endsAt);
  return start ? (end ? `${start} – ${end}` : start) : "No time set";
}

export default function MeetingsScreen() {
  const { project } = useControl();
  const allowed = Boolean(project?.can.inbox);
  const events = useControlQuery<{ events: ControlEvent[] }>(project && allowed ? `/api/control/projects/${project.id}/events` : null, { refetchOnFocus: false });
  const [picked, setPicked] = useState("");
  const list = events.data?.events ?? [];
  const eventId = picked || list.find((e) => e.when !== "past")?.id || list[0]?.id || "";

  return (
    <Screen scroll header={<ScreenHeader title="Meeting scheduler" />}>
      {!allowed ? (
        <EmptyState icon="shield" title="Not available" message="Your role can't manage meetings in this project." />
      ) : events.error && !events.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load events" message={events.error} actionLabel="Try again" onAction={() => void events.reload()} />
      ) : !events.data ? (
        <SkeletonList rows={4} variant="divided" />
      ) : !list.length ? (
        <EmptyState icon="calendar" title="No events yet" message="Meetings are booked between attendees of an event." />
      ) : (
        <View style={styles.stack}>
          <FilterChips options={list.map((e) => ({ value: e.id, label: e.name }))} value={eventId} onChange={setPicked} />
          <EventMeetings key={eventId} eventId={eventId} />
        </View>
      )}
    </Screen>
  );
}

function EventMeetings({ eventId }: { eventId: string }) {
  const toast = useToast();
  const [tab, setTab] = useState("meetings");
  // Whether the meeting is still ahead is decided when its sheet opens, not on every render.
  const [opened, setOpened] = useState<{ meeting: CommunityMeeting; future: boolean } | null>(null);
  const target = opened?.meeting ?? null;
  const future = opened?.future ?? false;
  const [request, setRequest] = useState<CommunityMeetingRequest | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const query = useControlQuery<CommunityMeetings>(`/api/control/community/events/${eventId}/meetings`);
  const meetings = query.data?.meetings ?? [];
  const requests = query.data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "pending").length;
  const count = (status: MeetingStatus) => meetings.filter((m) => m.status === status).length;
  const scheduled = count("scheduled");

  const update = async (meeting: CommunityMeeting, status: MeetingStatus) => {
    setBusy(status);
    const body: Record<string, string> = { status };
    if (status === "cancelled") body.cancelReason = reason.trim();
    const res = await controlApi<{ meeting: CommunityMeeting }>(`/api/control/community/meetings/${meeting.id}`, { method: "PATCH", body });
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(status === "cancelled" ? "Meeting cancelled. Both attendees will get an email." : "Meeting updated.");
    setOpened(null);
    setReason("");
    query.setData((prev) => (prev ? { ...prev, meetings: prev.meetings.map((m) => (m.id === meeting.id ? res.data.meeting : m)) } : prev));
  };

  const cancelRequest = async (r: CommunityMeetingRequest) => {
    setBusy("request");
    const res = await controlApi<{ status: string }>(`/api/control/community/meeting-requests/${r.id}`, { method: "DELETE" });
    setBusy(null);
    setRequest(null);
    if (!res.ok) {
      errorFeedback();
      toast.error(res.error);
      return void query.reload();
    }
    successFeedback();
    toast.success("Request cancelled.");
    query.setData((prev) => (prev ? { ...prev, requests: prev.requests.map((x) => (x.id === r.id ? { ...x, status: "cancelled" } : x)) } : prev));
  };

  return (
    <View style={styles.stack}>
      {query.data ? (
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout
            lead={{ label: "Scheduled", value: String(scheduled), hint: `of ${meetings.length} ${pluralize(meetings.length, "meeting", "meetings")}` }}
            items={[
              { label: "Completed", value: String(count("completed")) },
              { label: "No-shows", value: String(count("no_show")), tone: count("no_show") ? "warning" : "neutral" },
              { label: "Requests", value: String(pending), hint: "Pending", tone: pending ? "warning" : "neutral" },
            ]}
          />
        </Animated.View>
      ) : null}
      <Segmented
        options={[
          { value: "meetings", label: `Meetings · ${scheduled}` },
          { value: "requests", label: pending ? `Requests · ${pending}` : "Requests" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {query.error && !query.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load meetings" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      ) : !query.data ? (
        <SkeletonList rows={4} variant="divided" />
      ) : tab === "meetings" ? (
        !meetings.length ? (
          <EmptyState icon="calendar-check" title="No meetings booked" message="Meetings attendees book with each other, or that you book on the dashboard, appear here." />
        ) : (
          <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
            <ListGroup title={`${meetings.length} ${pluralize(meetings.length, "meeting", "meetings")}`}>
              {meetings.map((m, i) => (
                <MeetingRow
                  key={m.id}
                  meeting={m}
                  onPress={() => {
                    setReason("");
                    setOpened({ meeting: m, future: m.startsAt ? new Date(m.startsAt).getTime() > Date.now() : false });
                  }}
                  divider={i < meetings.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
        )
      ) : !requests.length ? (
        <EmptyState icon="mail" title="No requests yet" message="Requests attendees send each other show up here." />
      ) : (
        <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
          <ListGroup title={`${requests.length} ${pluralize(requests.length, "request", "requests")}`} action={pending ? <Text style={styles.pendingNote}>{`${pending} pending`}</Text> : undefined}>
            {requests.map((r, i) => (
              <RequestRow key={r.id} request={r} onPress={r.status === "pending" ? () => setRequest(r) : undefined} divider={i < requests.length - 1} />
            ))}
          </ListGroup>
        </Animated.View>
      )}

      <Sheet visible={Boolean(target)} onClose={() => setOpened(null)} title="Meeting">
        {target ? (
          <View style={styles.sheetBody}>
            <View style={styles.sheetHead}>
              <DateStub date={localDay(target.startsAt)} today={isToday(target.startsAt)} muted={target.status !== "scheduled"} />
              <View style={styles.sheetHeadText}>
                <Text style={styles.heading}>{target.people.join(" & ") || "Meeting"}</Text>
                <Text style={styles.mono}>{[timeRange(target), target.locationName].filter(Boolean).join(" · ")}</Text>
              </View>
            </View>
            <StatusButton label={MEETING_STATUS_META[target.status].label} tone={MEETING_STATUS_META[target.status].tone} />
            {target.notes ? <Text style={styles.note}>{target.notes}</Text> : null}
            {target.cancelReason ? <Text style={styles.note}>{`Cancelled: ${target.cancelReason}`}</Text> : null}
            {target.status === "scheduled" ? (
              <>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Button title="Completed" variant="secondary" loading={busy === "completed"} onPress={() => void update(target, "completed")} fullWidth />
                  </View>
                  <View style={styles.half}>
                    <Button title="No-show" variant="secondary" loading={busy === "no_show"} onPress={() => void update(target, "no_show")} fullWidth />
                  </View>
                </View>
                {future ? (
                  <>
                    <Field label="Reason (optional)" hint="Both attendees are emailed when you cancel.">
                      <Input value={reason} onChangeText={setReason} placeholder="e.g. Room unavailable" />
                    </Field>
                    <Button title="Cancel meeting" variant="destructive" loading={busy === "cancelled"} onPress={() => void update(target, "cancelled")} fullWidth />
                  </>
                ) : null}
              </>
            ) : target.status !== "cancelled" || future ? (
              <Button
                title={target.status === "cancelled" ? "Restore meeting" : "Mark scheduled"}
                icon="rotate-ccw"
                variant="secondary"
                loading={busy === "scheduled"}
                onPress={() => void update(target, "scheduled")}
                fullWidth
              />
            ) : null}
            <Text style={styles.note}>Rescheduling and booking happen on the dashboard, where room availability is checked.</Text>
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={Boolean(request)} onClose={() => setRequest(null)} title="Cancel this request?">
        {request ? (
          <View style={styles.sheetBody}>
            <Text style={styles.note}>{`${request.from} asked to meet ${request.to}. Cancelling withdraws it for both of them.`}</Text>
            <View style={styles.actions}>
              <Button title="Keep" variant="ghost" onPress={() => setRequest(null)} />
              <Button title="Cancel request" variant="destructive" loading={busy === "request"} onPress={() => void cancelRequest(request)} />
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

// A booked meeting: date stub, who's meeting, mono times and the room, and where it stands.
function MeetingRow({ meeting: m, onPress, divider }: { meeting: CommunityMeeting; onPress: () => void; divider: boolean }) {
  const meta = MEETING_STATUS_META[m.status];
  const done = m.status !== "scheduled";
  const who = m.people.join(" & ") || "Meeting";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${who}, ${timeRange(m)}, ${meta.label}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.meeting, divider && styles.divided, pressed && styles.pressed]}
    >
      <DateStub date={localDay(m.startsAt)} today={!done && isToday(m.startsAt)} muted={done} />
      <View style={styles.meetingText}>
        <View style={styles.titleRow}>
          <Text style={[styles.who, done && styles.whoMuted]} numberOfLines={1}>
            {who}
          </Text>
          <Pill label={meta.label} tone={meta.tone} variant="outline" />
        </View>
        <Text style={styles.times} numberOfLines={1}>
          {timeRange(m)}
        </Text>
        {m.locationName ? (
          <View style={styles.place}>
            <Icon name="map-pin" size={12} color={colors.textSecondary} />
            <Text style={styles.placeText} numberOfLines={1}>
              {m.locationName}
            </Text>
          </View>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

// A request between two attendees; only a pending one can be opened to cancel it.
function RequestRow({ request: r, onPress, divider }: { request: CommunityMeetingRequest; onPress?: () => void; divider: boolean }) {
  const meta = REQUEST_STATUS_META[r.status] ?? { label: r.status, tone: "neutral" as const };
  const facts = [r.proposedSlots ? `${r.proposedSlots} ${pluralize(r.proposedSlots, "slot", "slots")}` : "", r.createdAt ? fmtTimeAgo(r.createdAt) : ""].filter(Boolean).join(" · ");
  const content = (
    <>
      <Byline name={r.from} context={`to ${r.to}`} trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />} />
      {r.message ? (
        <Text style={styles.message} numberOfLines={2}>
          {r.message}
        </Text>
      ) : null}
      {facts ? <Text style={styles.requestFacts}>{facts}</Text> : null}
    </>
  );
  if (!onPress) return <View style={[styles.request, divider && styles.divided]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.from} to ${r.to}, ${meta.label}. Cancel request`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.request, divider && styles.divided, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  meeting: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  meetingText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  who: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  whoMuted: {
    color: colors.mutedForeground,
  },
  times: {
    ...type.monoSmall,
    color: colors.foreground,
  },
  place: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  placeText: {
    ...type.caption,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  request: {
    gap: spacing.sm,
    paddingVertical: 14,
  },
  message: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    paddingLeft: 42,
  },
  requestFacts: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
    paddingLeft: 42,
  },
  pendingNote: {
    ...type.captionStrong,
    color: colors.warning,
  },
  sheetBody: {
    gap: spacing.md,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sheetHeadText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  heading: {
    ...type.heading,
    color: colors.foreground,
  },
  mono: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
