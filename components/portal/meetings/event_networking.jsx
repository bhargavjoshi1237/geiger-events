"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, Handshake, Inbox, Info, UserRound, Users } from "lucide-react";

import { EmptyState, ScreenHeader, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { Button } from "@geiger/ui/button";
import { LogoLoading } from "@geiger/ui";
import { safeZone } from "@/lib/meetings/time";
import { Card, fmtDate, fmtDateTime } from "../portal_kit";
import { CountPill, getJson } from "./meetings_kit";
import { PeopleTab } from "./people_tab";
import { RequestsTab } from "./requests_tab";
import { MyMeetingsTab } from "./my_meetings_tab";
import { ProfileTab } from "./profile_tab";

const isLive = (m) => m.status === "scheduled" && Date.parse(m.endsAt) > Date.now();

function WindowNotice({ state }) {
  if (state.window === "open") return null;
  const text =
    state.window === "not_open"
      ? `Meeting requests open ${fmtDateTime(state.settings.opensAt)}. Set up your profile now so people can find you.`
      : "Meeting requests have closed for this event. Your booked meetings are still here.";
  return (
    <Card className="flex items-start gap-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  );
}

// One event's networking: directory, requests, schedule and the attendee's own profile.
export function EventNetworking({ eventId, member, onBack }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getJson(`/api/portal/meetings/${eventId}`).then(({ ok, data }) => {
      if (!alive) return;
      if (ok) {
        setState(data);
        setError("");
      } else {
        setError(data.error || "Couldn't load networking for this event.");
      }
    });
    return () => {
      alive = false;
    };
  }, [eventId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const back = onBack ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={onBack}
      className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> All events
    </Button>
  ) : null;

  if (error && !state) {
    return (
      <MainScreenWrapper>
        <ScreenHeader title="Networking" actions={back} />
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={Handshake} title="Networking isn't available" description={error} />
        </div>
      </MainScreenWrapper>
    );
  }

  if (!state) {
    return (
      <MainScreenWrapper>
        <div className="flex justify-center py-24">
          <LogoLoading size={48} />
        </div>
      </MainScreenWrapper>
    );
  }

  const tz = safeZone(state.event.timezone);
  const pendingIn = state.requests.filter((r) => r.direction === "incoming" && r.status === "pending").length;
  const upcoming = state.meetings.filter(isLive).length;
  const active = tab || (state.canNetwork ? "people" : "profile");
  const meta = [state.event.date ? fmtDate(state.event.date) : "", state.event.city].filter(Boolean).join(" · ");

  const tabs = [
    { value: "people", label: "People", icon: Users },
    { value: "requests", label: <>Requests<CountPill>{pendingIn}</CountPill></>, icon: Inbox },
    { value: "meetings", label: <>My meetings<CountPill>{upcoming}</CountPill></>, icon: CalendarClock },
    { value: "profile", label: "My profile", icon: UserRound },
  ];
  const tabSwitch = <SegmentedTabs tabs={tabs} value={active} onChange={setTab} />;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title={state.event.name}
        description={`Networking${meta ? ` · ${meta}` : ""} — meet other attendees 1:1.${
          state.settings.maxMeetings ? ` Up to ${state.settings.maxMeetings} meetings each.` : ""
        }`}
        actions={back}
      />

      <WindowNotice state={state} />

      {/* People places the switcher in its own toolbar row. */}
      {active !== "people" ? tabSwitch : null}

      {active === "people" ? (
        <PeopleTab
          tabs={tabSwitch}
          eventId={eventId}
          state={state}
          tz={tz}
          onChanged={reload}
          onGoProfile={() => setTab("profile")}
          onGoRequests={() => setTab("requests")}
        />
      ) : active === "requests" ? (
        <RequestsTab eventId={eventId} state={state} tz={tz} onChanged={reload} />
      ) : active === "meetings" ? (
        <MyMeetingsTab eventId={eventId} state={state} tz={tz} onChanged={reload} />
      ) : (
        <ProfileTab
          eventId={eventId}
          state={state}
          member={member}
          tz={tz}
          onSaved={() => {
            reload();
            setTab("people");
          }}
        />
      )}
    </MainScreenWrapper>
  );
}

export default EventNetworking;
