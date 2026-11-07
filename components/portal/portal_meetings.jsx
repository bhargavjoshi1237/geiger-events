"use client";

import React, { useEffect, useState } from "react";
import { Handshake } from "lucide-react";

import { EmptyState, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { LogoLoading } from "@geiger/ui";
import { TicketStubRow, fmtDate } from "./portal_kit";
import { getJson } from "./meetings/meetings_kit";
import { EventNetworking } from "./meetings/event_networking";

const WINDOW_LABEL = {
  open: "Open for meeting requests",
  not_open: "Requests open soon",
  closed: "Requests closed",
};

// Members-portal networking: 1:1 meetings at the events the member holds a ticket for.
export function PortalMeetings({ member, initialEventId = null }) {
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(() => {
    if (initialEventId) return initialEventId;
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("event");
  });

  useEffect(() => {
    let alive = true;
    getJson("/api/portal/meetings").then(({ ok, data }) => alive && setEvents(ok ? data.events || [] : []));
    return () => {
      alive = false;
    };
  }, []);

  if (events === null) {
    return (
      <MainScreenWrapper>
        <div className="flex justify-center py-24">
          <LogoLoading size={48} />
        </div>
      </MainScreenWrapper>
    );
  }

  const chosen = events.find((e) => e.id === eventId) || (events.length === 1 ? events[0] : null);
  if (chosen) {
    return (
      <EventNetworking
        key={chosen.id}
        eventId={chosen.id}
        member={member}
        onBack={events.length > 1 ? () => setEventId(null) : null}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Networking"
        description="Meet other attendees 1:1 — browse who's coming, request a meeting, and keep your schedule in one place."
      />
      {events.length ? (
        <div className="space-y-3">
          {events.map((e) => (
            <TicketStubRow
              key={e.id}
              image={e.coverUrl}
              icon={Handshake}
              name={e.name}
              description={WINDOW_LABEL[e.window] || ""}
              meta={[
                { label: e.date ? fmtDate(e.date) : "Date TBA" },
                e.city ? { label: e.city } : null,
                e.pendingIncoming ? { label: `${e.pendingIncoming} waiting for you` } : null,
                !e.optedIn ? { label: "Not joined yet", muted: true } : null,
              ].filter(Boolean)}
              stubValue={e.upcomingMeetings}
              stubLabel="meetings"
              onClick={() => setEventId(e.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Handshake}
            title="No networking yet"
            description="When an event you have a ticket for opens 1:1 meetings, you can find and meet other attendees here."
          />
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default PortalMeetings;
