"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, Inbox, XCircle } from "lucide-react";

import { DataTable, EmptyState, SearchInput, StatusPill, Toolbar } from "@/components/internal/shared/screen_kit";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { fmtSlot } from "@/lib/meetings/time";
import { REQUEST_FILTER_OPTIONS, REQUEST_STATUS_MAP, formatStamp, personName } from "./constants";
import { ForceScheduleDialog } from "./meeting_dialogs";

function RequestDetail({ request, onOpenChange, people, tz, onSchedule, onCancel }) {
  if (!request) return null;
  const open = request.status === "pending" || request.status === "expired";
  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {personName(people, request.fromMember)}
            <ArrowRight className="h-4 w-4 text-text-tertiary" />
            {personName(people, request.toMember)}
          </DialogTitle>
          <DialogDescription>Sent {formatStamp(request.createdAt)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Status</span>
            <StatusPill status={request.status} map={REQUEST_STATUS_MAP} />
          </div>
          {request.message ? (
            <div className="whitespace-pre-wrap rounded-lg border border-border bg-surface-card p-3 text-foreground">
              {request.message}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-secondary">Suggested times</p>
            {request.proposedSlots.length ? (
              <ul className="space-y-1">
                {request.proposedSlots.map((s) => (
                  <li key={s.start} className="text-foreground">
                    {fmtSlot(s.start, s.end, tz)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-tertiary">None</p>
            )}
          </div>
          {request.declineNote ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-text-secondary">Decline note</p>
              <p className="whitespace-pre-wrap text-foreground">{request.declineNote}</p>
            </div>
          ) : null}
          {request.respondedAt ? (
            <p className="text-xs text-text-tertiary">
              {request.cancelledBy === "organiser" ? "Cancelled by your team" : "Answered"} {formatStamp(request.respondedAt)}
            </p>
          ) : null}
        </div>
        {open ? (
          <DialogFooter>
            {request.status === "pending" ? (
              <Button variant="ghost" onClick={() => onCancel(request)}>
                <XCircle className="h-4 w-4" /> Cancel request
              </Button>
            ) : null}
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onSchedule(request)}>
              <CalendarCheck className="h-4 w-4" /> Schedule now
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function RequestsTab({ requests, people, settings, tz, sessions, meetings, onCancel, onForceSchedule }) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [scheduling, setScheduling] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return `${personName(people, r.fromMember)} ${personName(people, r.toMember)} ${r.message}`
        .toLowerCase()
        .includes(q);
    });
  }, [requests, status, search, people]);

  const openRequest = requests.find((r) => r.id === openId) || null;

  const columns = [
    {
      key: "people",
      header: "Request",
      render: (r) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
            {personName(people, r.fromMember)}
            <ArrowRight className="h-3.5 w-3.5 text-text-tertiary" />
            {personName(people, r.toMember)}
          </span>
          {r.message ? <span className="line-clamp-1 max-w-md text-xs text-text-secondary">{r.message}</span> : null}
        </div>
      ),
    },
    {
      key: "slots",
      header: "Suggested",
      render: (r) =>
        r.proposedSlots.length ? (
          <span className="text-sm text-text-secondary">
            {fmtSlot(r.proposedSlots[0].start, r.proposedSlots[0].end, tz)}
            {r.proposedSlots.length > 1 ? (
              <span className="text-text-tertiary"> +{r.proposedSlots.length - 1}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={REQUEST_STATUS_MAP} />,
    },
    {
      key: "sent",
      header: "Sent",
      align: "right",
      className: "text-right text-text-tertiary",
      render: (r) => <span className="text-xs">{formatStamp(r.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => (
        <ActionMenu
          label="Request actions"
          items={[
            (r.status === "pending" || r.status === "expired") && {
              icon: CalendarCheck,
              label: "Schedule now",
              onSelect: () => setScheduling(r),
            },
            { separator: true },
            r.status === "pending" && {
              icon: XCircle,
              label: "Cancel request",
              destructive: true,
              onSelect: () => onCancel(r),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={status} onValueChange={setStatus} options={REQUEST_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search people or messages…" />
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Inbox}
              title={requests.length ? "No requests match your filters" : "No meeting requests yet"}
              description={
                requests.length
                  ? "Try a different status or search."
                  : "When attendees ask each other to meet from the members portal, every request lands here."
              }
            />
          </div>
        }
      />

      <RequestDetail
        request={openRequest}
        onOpenChange={(o) => !o && setOpenId(null)}
        people={people}
        tz={tz}
        onCancel={(r) => {
          setOpenId(null);
          onCancel(r);
        }}
        onSchedule={(r) => {
          setOpenId(null);
          setScheduling(r);
        }}
      />

      <ForceScheduleDialog
        request={scheduling}
        onOpenChange={(o) => !o && setScheduling(null)}
        people={people}
        settings={settings}
        tz={tz}
        sessions={sessions}
        meetings={meetings}
        onConfirm={onForceSchedule}
      />
    </div>
  );
}

export default RequestsTab;
