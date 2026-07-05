"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Loader2, CheckCircle2, UserCheck } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SearchInput,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listRegistrationsByEvent } from "@/lib/supabase/registrations";
import { newId } from "@/components/internal/screens/events/sample_data";
import {
  listAttendanceByEvent,
  createCheckin,
} from "@/lib/supabase/checkin";

const ticketCode = (id) => String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase();

export function NameSearchLookupScreen() {
  const { projectId } = useProject();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [checkedIn, setCheckedIn] = useState(new Set());
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    listEvents(projectId).then((rows) => {
      if (!alive) return;
      const list = rows ?? [];
      setEvents(list);
      setEventId((cur) => cur || list[0]?.id || "");
      setLoadingEvents(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    const load = async () => {
      setLoadingList(true);
      const [regs, att] = await Promise.all([
        listRegistrationsByEvent(eventId),
        listAttendanceByEvent(eventId),
      ]);
      if (!alive) return;
      setAttendees(regs ?? []);
      setCheckedIn(
        new Set(
          (att ?? [])
            .filter((a) => a.status === "in")
            .map((a) => a.registrationId)
            .filter(Boolean),
        ),
      );
      setLoadingList(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [eventId]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return attendees;
    return attendees.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        ticketCode(a.id).toLowerCase().includes(q),
    );
  }, [attendees, search]);

  const admit = (reg) => {
    if (checkedIn.has(reg.id)) return;
    setCheckedIn((prev) => new Set(prev).add(reg.id));
    toast.success(`Checked in ${reg.name || "attendee"}.`);
    createCheckin({
      id: newId(),
      eventId,
      projectId,
      registrationId: reg.id,
      attendeeName: reg.name,
      ticketCode: ticketCode(reg.id),
      method: "manual",
      checkedInBy: "Name search",
      status: "in",
    }).then((res) => {
      if (res === null) {
        toast.error("Couldn't record the check-in.");
        setCheckedIn((prev) => {
          const next = new Set(prev);
          next.delete(reg.id);
          return next;
        });
      }
    });
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Name-search Lookup"
        description="Find an attendee by name, email, or ticket number when they don’t have their QR code — lost ticket, dead phone — and check them in on the spot."
      />

      <Toolbar>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="h-9 w-full bg-surface-card sm:max-w-xs">
            <SelectValue placeholder={loadingEvents ? "Loading events…" : "Select an event"} />
          </SelectTrigger>
          <SelectContent>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, ticket #…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loadingEvents ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !eventId ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={Search} title="No events yet" description="Create an event to look up its attendees." />
        </div>
      ) : loadingList ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading attendees…
        </div>
      ) : results.length ? (
        <div className="grid gap-2">
          {results.map((a) => {
            const isIn = checkedIn.has(a.id);
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{a.name || "Unnamed"}</span>
                    <Badge variant="neutral" className="font-mono text-[11px]">
                      {ticketCode(a.id)}
                    </Badge>
                    {a.status === "Waitlisted" ? (
                      <span className="text-[11px] font-medium uppercase tracking-wide text-amber-400">
                        Waitlisted
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {a.email || "No email"}
                    {a.partySize > 1 ? ` · party of ${a.partySize}` : ""}
                  </p>
                </div>
                {isIn ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Checked in
                  </span>
                ) : (
                  <Button
                    className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => admit(a)}
                  >
                    <UserCheck className="h-4 w-4" /> Check in
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Search}
            title={attendees.length ? "No matches" : "No attendees yet"}
            description={
              attendees.length
                ? "Try a different name, email, or ticket number."
                : "Registrations for this event will appear here to look up and check in."
            }
          />
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default NameSearchLookupScreen;
