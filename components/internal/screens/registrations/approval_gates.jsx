"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Accessibility,
  Check,
  CheckCheck,
  ChevronRight,
  Loader2,
  Utensils,
  X,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorHeader } from "@/components/internal/shared/editor_shell";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Badge } from "@geiger/ui/badge";
import { listEvents } from "@/lib/supabase/events";
import {
  listRegistrations,
  approveRegistration,
  updateRegistration,
} from "@/lib/supabase/registrations";
import { getUser } from "@/lib/supabase/user";
import { useProject } from "@/context/project-context";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { formatDate, formatDateTime, initials } from "./constants";

const PAGE_EVENTS = 60;
const PAGE_CARDS = 40;

const SORT_OPTIONS = [
  { value: "pending-desc", label: "Most pending" },
  { value: "pending-asc", label: "Fewest pending" },
  { value: "date-asc", label: "Event date" },
  { value: "name-asc", label: "Name (A–Z)" },
];

function PendingPill({ count }) {
  return (
    <Badge variant="neutral" className="shrink-0 gap-1.5 tabular-nums">
      {count} pending
    </Badge>
  );
}

function RequestCard({ reg, onApprove, onDecline }) {
  const answers =
    reg.answers && typeof reg.answers === "object" ? reg.answers : {};
  const answerEntries = Object.entries(answers).filter(
    ([, v]) => v !== "" && v != null && v !== false,
  );

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
        {initials(reg.name) || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-foreground">{reg.name}</span>
          <span className="text-xs text-text-secondary">{reg.email}</span>
        </div>
        <p className="mt-0.5 text-xs text-text-tertiary">
          Requested {formatDateTime(reg.createdAt)}
          {reg.partySize > 1 ? ` · party of ${reg.partySize}` : ""}
        </p>

        {reg.dietary || reg.accessibility || answerEntries.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {reg.dietary ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-muted-foreground">
                <Utensils className="h-3 w-3 text-text-tertiary" /> {reg.dietary}
              </span>
            ) : null}
            {reg.accessibility ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-muted-foreground">
                <Accessibility className="h-3 w-3 text-text-tertiary" />{" "}
                {reg.accessibility}
              </span>
            ) : null}
            {answerEntries.slice(0, 3).map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-muted-foreground"
              >
                <span className="text-text-tertiary">{k}:</span> {String(v)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => onApprove(reg)}
        >
          <Check className="h-4 w-4" /> Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={() => onDecline(reg)}
        >
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    </div>
  );
}

export function ApprovalGatesScreen() {
  const [regs, setRegs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const [openEventId, setOpenEventId] = useState(null);
  const [listSearch, setListSearch] = useState("");
  const [listSort, setListSort] = useState("pending-desc");
  const [listLimit, setListLimit] = useState(PAGE_EVENTS);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailLimit, setDetailLimit] = useState(PAGE_CARDS);

  const [declineTarget, setDeclineTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [reason, setReason] = useState("");
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([listRegistrations(projectId), listEvents(projectId)]).then(([rows, evts]) => {
      if (!alive) return;
      setRegs(rows ?? []);
      setEvents(evts ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventNames = useMemo(() => {
    const m = {};
    for (const e of events) m[e.id] = e;
    return m;
  }, [events]);

  const groups = useMemo(() => {
    const by = {};
    for (const r of regs) {
      if (r.status !== "Pending") continue;
      (by[r.eventId] ||= []).push(r);
    }
    return Object.entries(by)
      .map(([eventId, list]) => ({
        eventId,
        name: eventNames[eventId]?.name || "Unknown event",
        date: eventNames[eventId]?.date || "",
        list: list.sort((a, b) =>
          (a.createdAt || "").localeCompare(b.createdAt || ""),
        ),
      }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [regs, eventNames]);

  const persist = (id, approve) => {
    approveRegistration(id, approve, userId).then((res) => {
      if (res === null) return;
      if (res === false) {
        updateRegistration(id, {
          status: approve ? "Confirmed" : "Declined",
        }).then((u) => {
          if (u === false) toast.error("Couldn't save the decision.");
        });
      }
    });
  };

  const notifyApproved = (reg) => {
    if (typeof window === "undefined" || !reg?.email) return;
    const event = eventNames[reg.eventId];
    fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/registrations/approval-email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reg.name,
          email: reg.email,
          eventId: reg.eventId,
          eventName: event?.name || "",
          eventDate: event?.date || "",
          origin: window.location.origin,
          basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
        }),
      },
    ).catch(() => {});
  };

  const decide = (reg, approve) => {
    setRegs((prev) =>
      prev.map((r) =>
        r.id === reg.id
          ? { ...r, status: approve ? "Confirmed" : "Declined" }
          : r,
      ),
    );
    toast.success(`${approve ? "Approved" : "Declined"} ${reg.name}.`);
    persist(reg.id, approve);
    if (approve) notifyApproved(reg);
  };

  const decideMany = (list, approve) => {
    const ids = new Set(list.map((r) => r.id));
    setRegs((prev) =>
      prev.map((r) =>
        ids.has(r.id) ? { ...r, status: approve ? "Confirmed" : "Declined" } : r,
      ),
    );
    toast.success(
      `${approve ? "Approved" : "Declined"} ${list.length} registrations.`,
    );
    list.forEach((r) => persist(r.id, approve));
    if (approve) list.forEach(notifyApproved);
  };

  const confirmDecline = () => {
    if (declineTarget?.group) decideMany(declineTarget.group, false);
    else if (declineTarget) decide(declineTarget, false);
    setDeclineTarget(null);
    setReason("");
  };

  const confirmApproveAll = () => {
    if (approveTarget?.group) decideMany(approveTarget.group, true);
    setApproveTarget(null);
  };

  const openGroup = groups.find((g) => g.eventId === openEventId) || null;

  if (openGroup) {
    const matches = openGroup.list.filter((r) =>
      detailSearch
        ? `${r.name} ${r.email}`
            .toLowerCase()
            .includes(detailSearch.toLowerCase())
        : true,
    );
    const shown = matches.slice(0, detailLimit);

    return (
      <MainScreenWrapper>
        <EditorHeader
          back={{
            label: "All Events",
            onClick: () => {
              setOpenEventId(null);
              setDetailSearch("");
              setDetailLimit(PAGE_CARDS);
            },
          }}
          title={openGroup.name}
          badges={<PendingPill count={openGroup.list.length} />}
          meta={openGroup.date ? formatDate(openGroup.date) : null}
          actions={
            <>
              <Button
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={() => setDeclineTarget({ group: openGroup.list })}
              >
                <X className="h-4 w-4" /> Decline all
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setApproveTarget({ group: openGroup.list })}
              >
                <CheckCheck className="h-4 w-4" /> Approve all
              </Button>
            </>
          }
        />

        <Toolbar>
          <span className="text-sm text-text-tertiary">
            {detailSearch
              ? `${matches.length} of ${openGroup.list.length} match`
              : `Showing ${shown.length} of ${openGroup.list.length}`}
          </span>
          <SearchInput
            value={detailSearch}
            onChange={(v) => {
              setDetailSearch(v);
              setDetailLimit(PAGE_CARDS);
            }}
            placeholder="Search this event…"
          />
        </Toolbar>

        {shown.length ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
            <div className="divide-y divide-border">
              {shown.map((reg) => (
                <RequestCard
                  key={reg.id}
                  reg={reg}
                  onApprove={(r) => decide(r, true)}
                  onDecline={(r) => setDeclineTarget(r)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={CheckCheck}
              title={
                detailSearch ? "No requests match your search" : "All clear here"
              }
              description={
                detailSearch
                  ? "Try a different name or email."
                  : "Every request for this event has been handled."
              }
            />
          </div>
        )}

        {shown.length < matches.length ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setDetailLimit((l) => l + PAGE_CARDS)}
            >
              Show more ({matches.length - shown.length} left)
            </Button>
          </div>
        ) : null}

        <DeclineDialog
          target={declineTarget}
          reason={reason}
          setReason={setReason}
          onCancel={() => {
            setDeclineTarget(null);
            setReason("");
          }}
          onConfirm={confirmDecline}
        />

        <ApproveAllDialog
          target={approveTarget}
          onCancel={() => setApproveTarget(null)}
          onConfirm={confirmApproveAll}
        />
      </MainScreenWrapper>
    );
  }

  const listMatches = groups.filter((g) =>
    listSearch ? g.name.toLowerCase().includes(listSearch.toLowerCase()) : true,
  );
  const listSorted = [...listMatches].sort((a, b) => {
    switch (listSort) {
      case "pending-asc":
        return a.list.length - b.list.length;
      case "date-asc":
        return (a.date || "9999").localeCompare(b.date || "9999");
      case "name-asc":
        return a.name.localeCompare(b.name);
      default:
        return b.list.length - a.list.length;
    }
  });
  const listShown = listSorted.slice(0, listLimit);

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Approval Gates"
        description="Events with registrations waiting on your decision. Open one to review its queue, or approve a whole event at once."
      />

      <Toolbar>
        <FilterDropdown
          value={listSort}
          onValueChange={setListSort}
          options={SORT_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={listSearch}
          onChange={(v) => {
            setListSearch(v);
            setListLimit(PAGE_EVENTS);
          }}
          placeholder="Search events…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading approvals…
        </div>
      ) : listShown.length ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
            <div className="divide-y divide-border">
              {listShown.map((g) => (
                <div
                  key={g.eventId}
                  className="flex w-full items-center gap-3 pr-5 transition-colors hover:bg-surface-hover"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenEventId(g.eventId);
                      setDetailSearch("");
                      setDetailLimit(PAGE_CARDS);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 py-4 pl-5 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{g.name}</p>
                      {g.date ? (
                        <p className="truncate text-xs text-text-secondary">
                          {formatDate(g.date)}
                        </p>
                      ) : null}
                    </div>
                    <PendingPill count={g.list.length} />
                  </button>
                  <Button
                    size="sm"
                    className="hidden shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:inline-flex"
                    onClick={() => setApproveTarget({ group: g.list })}
                  >
                    <CheckCheck className="h-4 w-4" /> Approve all
                  </Button>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
                </div>
              ))}
            </div>
          </div>

          {listShown.length < listMatches.length ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={() => setListLimit((l) => l + PAGE_EVENTS)}
              >
                Show more events ({listMatches.length - listShown.length} left)
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={CheckCheck}
            title={listSearch ? "No events match your search" : "You're all caught up"}
            description={
              listSearch
                ? "Try a different event name."
                : "When an event requires approval, new registrations wait here for your decision."
            }
          />
        </div>
      )}

      <DeclineDialog
        target={declineTarget}
        reason={reason}
        setReason={setReason}
        onCancel={() => {
          setDeclineTarget(null);
          setReason("");
        }}
        onConfirm={confirmDecline}
      />

      <ApproveAllDialog
        target={approveTarget}
        onCancel={() => setApproveTarget(null)}
        onConfirm={confirmApproveAll}
      />
    </MainScreenWrapper>
  );
}

function ApproveAllDialog({ target, onCancel, onConfirm }) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>Approve {target?.group?.length ?? 0} registrations</DialogTitle>
          <DialogDescription>
            Every pending registration for this event will be approved and each
            attendee will be emailed a continue &amp; pay link. This can&apos;t be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-500/90 text-white hover:bg-emerald-500"
            onClick={onConfirm}
          >
            <CheckCheck className="h-4 w-4" /> Approve all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({ target, reason, setReason, onCancel, onConfirm }) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>
            Decline{" "}
            {target?.group ? `${target.group.length} registrations` : target?.name}
          </DialogTitle>
          <DialogDescription>
            Add an optional reason — it can be included in the notification email.
          </DialogDescription>
        </DialogHeader>
        <Field label="Reason">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. This event is members-only."
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-red-500/90 text-white hover:bg-red-500"
            onClick={onConfirm}
          >
            <X className="h-4 w-4" /> Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApprovalGatesScreen;
