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
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listRegistrationsByEvent } from "@/lib/supabase/registrations";
import {
  listAttendanceByEvent,
  admitCheckinAsMember,
} from "@/lib/supabase/checkin";
import { blockedMessage } from "@/lib/checkin/scan";
import { CapacityOverrideDialog } from "@/components/checkin_routes/capacity_override_dialog";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";

import { LogoLoading } from "@geiger/ui";
const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Pending", label: "Pending" },
  { value: "Waitlisted", label: "Waitlisted" },
  { value: "Declined", label: "Declined" },
  { value: "Cancelled", label: "Cancelled" },
];

const CHECKIN_FILTER_OPTIONS = [
  { value: "all", label: "All attendees" },
  { value: "in", label: "Checked in" },
  { value: "out", label: "Not checked in" },
];

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "recent", label: "Recently registered" },
  { value: "party-desc", label: "Largest party" },
];

const SORT_COMPARATORS = {
  "name-asc": (a, b) => a.name.localeCompare(b.name),
  "name-desc": (a, b) => b.name.localeCompare(a.name),
  recent: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  "party-desc": (a, b) => (b.partySize || 1) - (a.partySize || 1),
};

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
  const [admittingId, setAdmittingId] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [checkinFilter, setCheckinFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

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
    const filtered = attendees.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      const isIn = checkedIn.has(a.id);
      if (checkinFilter === "in" && !isIn) return false;
      if (checkinFilter === "out" && isIn) return false;
      if (
        q &&
        !(
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          ticketCode(a.id).toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
    return [...filtered].sort(SORT_COMPARATORS[sortBy] || SORT_COMPARATORS["name-asc"]);
  }, [attendees, search, statusFilter, checkinFilter, sortBy, checkedIn]);

  const pager = usePagination(results, {
    resetKey: `${eventId}|${search}|${statusFilter}|${checkinFilter}|${sortBy}`,
  });

  const markIn = (id) => setCheckedIn((prev) => new Set(prev).add(id));

  // Same admit as the gate scanners: ticket status, duplicates and Capacity Control caps all apply.
  const admit = async (reg, overrideReason = null) => {
    if (checkedIn.has(reg.id) || admittingId) return;
    const name = reg.name || "attendee";
    setAdmittingId(reg.id);
    const res = await admitCheckinAsMember({
      eventId,
      registrationId: reg.id,
      name: reg.name,
      staff: "Name search",
      overrideReason,
    });
    setAdmittingId(null);
    if (!res) {
      toast.error("Couldn't record the check-in.");
    } else if (res.ok) {
      markIn(reg.id);
      toast.success(res.override ? `Checked in ${name} — capacity override recorded.` : `Checked in ${name}.`);
    } else if (res.already) {
      markIn(reg.id);
      toast.warning(`${name} is already checked in.`);
    } else if (res.capacity) {
      setOverrideTarget({ reg, name: reg.name, party: res.party, zone: res.zone, occupancy: res.occupancy, cap: res.cap });
    } else if (res.blocked) {
      toast.error(blockedMessage(res.reason, reg.name));
    } else {
      toast.error("Couldn't record the check-in.");
    }
  };

  const confirmOverride = async (reason) => {
    const target = overrideTarget;
    if (!target) return;
    await admit(target.reg, reason);
    setOverrideTarget(null);
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Name-search Lookup"
        description="Find an attendee by name, email, or ticket number when they don’t have their QR code — lost ticket, dead phone — and check them in on the spot."
      />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="h-9 w-full bg-surface-card sm:w-auto sm:max-w-[220px]">
              <SelectValue placeholder={loadingEvents ? "Loading Events…" : "Select an event"} />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            placeholder="All statuses"
            height="h-9"
          />
          <FilterDropdown
            value={checkinFilter}
            onValueChange={setCheckinFilter}
            options={CHECKIN_FILTER_OPTIONS}
            placeholder="All attendees"
            height="h-9"
          />
          <FilterDropdown
            value={sortBy}
            onValueChange={setSortBy}
            options={SORT_OPTIONS}
            placeholder="Sort"
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, ticket #…"
        />
      </Toolbar>

      {loadingEvents ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <LogoLoading size={40} />
        </div>
      ) : !eventId ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={Search} title="No events yet" description="Create an event to look up its attendees." />
        </div>
      ) : loadingList ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <LogoLoading size={40} label="Loading attendees" />
        </div>
      ) : results.length ? (
        <div className="space-y-3">
          <div className="grid gap-2">
            {pager.pageItems.map((a) => {
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
                        <span className="text-[11px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
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
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> Checked in
                    </span>
                  ) : (
                    <Button
                      className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={admittingId === a.id}
                      onClick={() => admit(a)}
                    >
                      {admittingId === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      Check in
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <ListPagination {...pager} itemLabel="attendees" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Search}
            title={attendees.length ? "No matches" : "No attendees yet"}
            description={
              attendees.length
                ? "Try a different name, email, ticket number, or filter."
                : "Registrations for this event will appear here to look up and check in."
            }
            action={
              attendees.length > 0 && (search || statusFilter !== "all" || checkinFilter !== "all") ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setCheckinFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      <CapacityOverrideDialog
        target={overrideTarget}
        onOpenChange={(open) => !open && setOverrideTarget(null)}
        onConfirm={confirmOverride}
      />
    </MainScreenWrapper>
  );
}

export default NameSearchLookupScreen;
