import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MEETING_STATUS_META, REQUEST_STATUS_META } from "@/components/control/community/meta";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtDateTime, fmtTimeAgo } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { CommunityMeeting, CommunityMeetingRequest, CommunityMeetings, MeetingStatus } from "@/types/control_community";
import type { ControlEvent } from "@/types/portal";

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
      <Segmented
        options={[
          { value: "meetings", label: `Meetings · ${meetings.filter((m) => m.status === "scheduled").length}` },
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
          <View style={styles.group}>
            {meetings.map((m, i) => {
              const meta = MEETING_STATUS_META[m.status];
              return (
                <ListRow
                  key={m.id}
                  leading={<IconTile icon="users" size={36} tone={m.status === "scheduled" ? "neutral" : "outline"} />}
                  title={m.people.join(" & ") || "Meeting"}
                  subtitle={[fmtDateTime(m.startsAt), m.locationName].filter(Boolean).join(" · ")}
                  trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
                  onPress={() => {
                    setReason("");
                    setOpened({ meeting: m, future: m.startsAt ? new Date(m.startsAt).getTime() > Date.now() : false });
                  }}
                  divider={i < meetings.length - 1}
                />
              );
            })}
          </View>
        )
      ) : !requests.length ? (
        <EmptyState icon="mail" title="No requests yet" message="Requests attendees send each other show up here." />
      ) : (
        <View style={styles.group}>
          {requests.map((r, i) => {
            const meta = REQUEST_STATUS_META[r.status] ?? { label: r.status, tone: "neutral" as const };
            return (
              <ListRow
                key={r.id}
                leading={<IconTile icon="send" size={36} />}
                title={`${r.from} → ${r.to}`}
                subtitle={[r.message, r.createdAt ? fmtTimeAgo(r.createdAt) : ""].filter(Boolean).join(" · ")}
                trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
                onPress={r.status === "pending" ? () => setRequest(r) : undefined}
                divider={i < requests.length - 1}
              />
            );
          })}
        </View>
      )}

      <Sheet visible={Boolean(target)} onClose={() => setOpened(null)} title="Meeting">
        {target ? (
          <View style={styles.sheetBody}>
            <Text style={styles.heading}>{target.people.join(" & ")}</Text>
            <Text style={styles.note}>{[fmtDateTime(target.startsAt), target.locationName].filter(Boolean).join(" · ")}</Text>
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

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  sheetBody: {
    gap: spacing.md,
  },
  heading: {
    ...type.heading,
    color: colors.foreground,
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
