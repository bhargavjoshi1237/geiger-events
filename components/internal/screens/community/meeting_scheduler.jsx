"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CalendarRange, Download, Inbox, Settings2, Users } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, SegmentedTabs, StatsBar, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { LogoLoading } from "@geiger/ui";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";
import {
  cancelMeetingRequest,
  createMeeting,
  expireMeetingRequests,
  getMeetingSettings,
  listEventSessions,
  listMeetingAttendees,
  listMeetingProfiles,
  listMeetingRequests,
  listMeetings,
  notifyMeetingChange,
  rescheduleMeeting,
  saveMeetingSettings,
  updateMeeting,
  updateMeetingProfile,
} from "@/lib/supabase/meetings";
import { bookingWindowState, defaultMeetingSettings } from "@/lib/meetings/settings";
import { locationUtilisation } from "@/lib/meetings/slots";
import { fmtDayOf, fmtTime, safeZone } from "@/lib/meetings/time";
import { buildPeople, isFuture, personName, slugify } from "./meeting_scheduler/constants";
import { ScheduleTab } from "./meeting_scheduler/schedule_tab";
import { RequestsTab } from "./meeting_scheduler/requests_tab";
import { DirectoryTab } from "./meeting_scheduler/directory_tab";
import { SettingsTab } from "./meeting_scheduler/settings_tab";

const TABS = [
  { value: "schedule", label: "Schedule", icon: CalendarRange },
  { value: "requests", label: "Requests", icon: Inbox },
  { value: "directory", label: "Directory", icon: Users },
  { value: "settings", label: "Settings", icon: Settings2 },
];

const WINDOW_MAP = {
  open: { label: "Networking open", variant: "success", dotClass: "bg-emerald-400" },
  not_open: { label: "Requests not open yet", variant: "warning", dotClass: "bg-amber-400" },
  closed: { label: "Requests closed", variant: "neutral", dotClass: "bg-[#737373]" },
  off: { label: "Networking off", variant: "neutral", dotClass: "bg-[#737373]" },
};

const isUpcomingEvent = (e) => !e.date || new Date(`${e.date}T23:59:59`) >= new Date();

export function MeetingSchedulerScreen() {
  const { projectId } = useProject();
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState("");
  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState("schedule");
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    listEvents(projectId).then((rows) => {
      if (!alive) return;
      const list = [...(rows ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      setEvents(list);
      setEventId((cur) => cur || list.find(isUpcomingEvent)?.id || list[0]?.id || "");
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const event = useMemo(() => (events || []).find((e) => e.id === eventId) || null, [events, eventId]);
  const tz = safeZone(event?.timezone);

  const loadData = useCallback(async (ev) => {
    await expireMeetingRequests(ev.id);
    const [settings, profiles, requests, meetings, attendees, sessions] = await Promise.all([
      getMeetingSettings(ev),
      listMeetingProfiles(ev.id),
      listMeetingRequests(ev.id),
      listMeetings(ev.id),
      listMeetingAttendees(ev.id),
      listEventSessions(ev.projectId, ev.id),
    ]);
    return {
      eventId: ev.id,
      settings: settings || { ...defaultMeetingSettings(ev), id: null, saved: false },
      profiles: profiles ?? [],
      requests: requests ?? [],
      meetings: meetings ?? [],
      attendees: attendees ?? [],
      sessions: sessions ?? [],
    };
  }, []);

  useEffect(() => {
    if (!event) return undefined;
    let alive = true;
    loadData(event).then((next) => alive && setData(next));
    return () => {
      alive = false;
    };
  }, [event, loadData]);

  const current = data && data.eventId === eventId ? data : null;
  const people = useMemo(() => buildPeople(current?.attendees, current?.profiles), [current]);
  const options = useMemo(
    () => [...people.values()].filter((p) => p.hasTicket).sort((a, b) => a.name.localeCompare(b.name)),
    [people],
  );

  const stats = useMemo(() => {
    if (!current) return [];
    const { profiles, requests, meetings, attendees, settings } = current;
    const optedIn = profiles.filter((p) => p.optedIn && !p.hidden).length;
    const accepted = requests.filter((r) => r.status === "accepted").length;
    const answered = accepted + requests.filter((r) => r.status === "declined").length;
    const booked = meetings.filter((m) => m.status !== "cancelled");
    const upcoming = booked.filter((m) => m.status === "scheduled" && isFuture(m.endsAt)).length;
    const util = locationUtilisation(settings, tz, meetings);
    return [
      { label: "Opted in", value: String(optedIn), footer: `of ${attendees.length} ticket holder${attendees.length === 1 ? "" : "s"}` },
      {
        label: "Requests",
        value: String(requests.length),
        footer: answered ? `${Math.round((accepted / answered) * 100)}% accepted` : "No answers yet",
      },
      { label: "Meetings", value: String(booked.length), footer: `${upcoming} upcoming` },
      {
        label: "Utilisation",
        value: util == null ? "—" : `${Math.round(util * 100)}%`,
        footer: settings.locations.length
          ? `${settings.locations.length} location${settings.locations.length === 1 ? "" : "s"}`
          : "No locations set",
      },
    ];
  }, [current, tz]);

  const patch = (next) => setData((d) => (d && d.eventId === eventId ? { ...d, ...next } : d));

  const refreshBookings = async () => {
    if (!event) return;
    const [meetings, requests] = await Promise.all([listMeetings(event.id), listMeetingRequests(event.id)]);
    patch({ ...(meetings ? { meetings } : {}), ...(requests ? { requests } : {}) });
  };

  const handleCreate = async (input) => {
    const res = await createMeeting({ eventId: event.id, ...input });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success("Meeting booked. Both attendees will get an email.");
    notifyMeetingChange("meeting_confirmed", res.id);
    await refreshBookings();
    return true;
  };

  const handleForceSchedule = async (request, slot, locationId) => {
    const res = await createMeeting({
      eventId: event.id,
      participants: [request.fromMember, request.toMember],
      startsAt: slot.start,
      endsAt: slot.end,
      locationId,
      requestId: request.id,
    });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success("Request scheduled. Both attendees will get an email.");
    notifyMeetingChange("meeting_confirmed", res.id);
    await refreshBookings();
    return true;
  };

  const handleReschedule = async (meeting, slot) => {
    const res = await rescheduleMeeting(meeting.id, slot);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success("Meeting moved. Both attendees will get an email.");
    notifyMeetingChange("meeting_rescheduled", meeting.id);
    await refreshBookings();
    return true;
  };

  const handleUpdate = async (meeting, change) => {
    const res = await updateMeeting(meeting.id, change);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    patch({ meetings: current.meetings.map((m) => (m.id === meeting.id ? res.meeting : m)) });
    if (change.status === "cancelled") {
      toast.success("Meeting cancelled. Both attendees will get an email.");
      notifyMeetingChange("meeting_cancelled", meeting.id);
    } else {
      toast.success("Meeting updated.");
    }
    return true;
  };

  const handleCancelRequest = async (request) => {
    const saved = await cancelMeetingRequest(request.id);
    if (!saved) {
      toast.error("Couldn't cancel the request — it may have been answered already.");
      await refreshBookings();
      return;
    }
    patch({ requests: current.requests.map((r) => (r.id === saved.id ? saved : r)) });
    toast.success("Request cancelled.");
  };

  const handleUpdateProfile = async (profile, change) => {
    const saved = await updateMeetingProfile(profile.id, change);
    if (!saved) {
      toast.error("Couldn't update the profile.");
      return;
    }
    patch({ profiles: current.profiles.map((p) => (p.id === saved.id ? saved : p)) });
    toast.success(
      "hidden" in change ? (change.hidden ? "Profile hidden." : "Profile visible again.") : "Role updated.",
    );
  };

  const handleSaveSettings = async (draft) => {
    const saved = await saveMeetingSettings(event, draft, userId);
    if (!saved) {
      toast.error("Couldn't save the settings.");
      return false;
    }
    patch({ settings: saved });
    toast.success("Settings saved.");
    return true;
  };

  const exportCsv = () => {
    if (!current?.meetings.length) return;
    const nameAt = (m, i) => personName(people, m.participants[i]);
    const emailAt = (m, i) => people.get(m.participants[i])?.email || "";
    downloadCsv(
      [
        { header: "Date", value: (m) => fmtDayOf(m.startsAt, tz) },
        { header: "Start", value: (m) => fmtTime(m.startsAt, tz) },
        { header: "End", value: (m) => fmtTime(m.endsAt, tz) },
        { header: "Timezone", value: () => tz },
        { header: "Location", value: (m) => m.locationName || "Unassigned" },
        { header: "Attendee 1", value: (m) => nameAt(m, 0) },
        { header: "Attendee 1 email", value: (m) => emailAt(m, 0) },
        { header: "Attendee 2", value: (m) => nameAt(m, 1) },
        { header: "Attendee 2 email", value: (m) => emailAt(m, 1) },
        { header: "Status", value: (m) => m.status },
        { header: "Booked via", value: (m) => (m.requestId ? "Attendee request" : "Organiser") },
        { header: "Notes", value: (m) => m.notes },
        { header: "Cancel reason", value: (m) => m.cancelReason },
      ],
      [...current.meetings].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt))),
      `meetings-${slugify(event?.name)}.csv`,
    );
    toast.success("Meetings exported.");
  };

  const header = (
    <ScreenHeader
      title="Meeting Scheduler"
      description="1:1 networking for your attendees — they opt in, request each other from the members portal, and every meeting lands on a slot that avoids the agenda."
      actions={
        <Button
          variant="outline"
          disabled={!current?.meetings.length}
          onClick={exportCsv}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      }
    />
  );

  const tabSwitch = <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />;

  if (events === null) {
    return (
      <MainScreenWrapper>
        {header}
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} />
        </div>
      </MainScreenWrapper>
    );
  }

  if (!events.length) {
    return (
      <MainScreenWrapper>
        {header}
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CalendarClock}
            title="No events yet"
            description="Create an event first — networking is set up per event."
          />
        </div>
      </MainScreenWrapper>
    );
  }

  const windowState = current ? bookingWindowState(current.settings) : "off";

  return (
    <MainScreenWrapper>
      {header}

      <div className="flex flex-wrap items-center gap-3">
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="w-full bg-surface-card sm:w-[280px]">
            <SelectValue placeholder="Choose an event" />
          </SelectTrigger>
          <SelectContent>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {current ? <StatusPill status={windowState} map={WINDOW_MAP} /> : null}
      </div>

      {!current ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} />
        </div>
      ) : (
        <>
          <StatsBar stats={stats} />

          {/* Requests and Directory place the switcher in their own toolbar row. */}
          {tab !== "requests" && tab !== "directory" ? tabSwitch : null}

          {tab === "schedule" ? (
            <ScheduleTab
              tz={tz}
              settings={current.settings}
              sessions={current.sessions}
              meetings={current.meetings}
              people={people}
              options={options}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onReschedule={handleReschedule}
              onOpenSettings={() => setTab("settings")}
            />
          ) : tab === "requests" ? (
            <RequestsTab
              tabs={tabSwitch}
              requests={current.requests}
              people={people}
              settings={current.settings}
              tz={tz}
              sessions={current.sessions}
              meetings={current.meetings}
              onCancel={handleCancelRequest}
              onForceSchedule={handleForceSchedule}
            />
          ) : tab === "directory" ? (
            <DirectoryTab
              tabs={tabSwitch}
              profiles={current.profiles}
              people={people}
              meetings={current.meetings}
              onUpdateProfile={handleUpdateProfile}
            />
          ) : (
            <SettingsTab
              event={event}
              settings={current.settings}
              sessions={current.sessions}
              tz={tz}
              onSave={handleSaveSettings}
            />
          )}
        </>
      )}
    </MainScreenWrapper>
  );
}

export default MeetingSchedulerScreen;
