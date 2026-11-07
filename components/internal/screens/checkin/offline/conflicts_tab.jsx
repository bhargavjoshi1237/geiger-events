"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, GitCompareArrows, Loader2, RotateCcw } from "lucide-react";

import { DataTable, EmptyState, Field, StatusPill, Toolbar } from "@/components/internal/shared/screen_kit";
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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { getUser } from "@/lib/supabase/user";
import { reopenCheckinConflict, resolveCheckinConflict } from "@/lib/supabase/checkin_offline";
import {
  CONFLICT_FILTER_OPTIONS,
  CONFLICT_KIND_MAP,
  CONFLICT_STATUS_MAP,
  RESOLUTION_LABELS,
  clockTime,
  deviceName,
} from "./shared";

const KIND_HELP = {
  duplicate: "This ticket was admitted on two devices while at least one was offline. Only the first admission counts toward attendance.",
  reentry: "The ticket had already left and re-entry isn't allowed here, but an offline device let it back in.",
  over_capacity: "An offline admit that, once synced, took this area past its hard cap. The guest is counted as inside.",
  invalid_ticket: "An offline device admitted a ticket the server refuses (cancelled, refunded or unknown). It wasn't counted.",
};

function Admission({ label, at, gate, device, offline }) {
  return (
    <div className="rounded-lg border border-border bg-surface-card px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="mt-1 text-sm text-foreground">{at ? clockTime(at) : "—"}</p>
      <p className="text-xs text-text-secondary">
        {[gate, device, offline ? "offline" : ""].filter(Boolean).join(" · ") || "—"}
      </p>
    </div>
  );
}

function ReviewDialog({ conflict, devicesById, onOpenChange, onSaved }) {
  const [note, setNote] = useState(conflict?.note || "");
  const [busy, setBusy] = useState("");
  const duplicateKind = conflict?.kind === "duplicate" || conflict?.kind === "reentry";

  const resolve = async (resolution) => {
    setBusy(resolution);
    const user = await getUser().catch(() => null);
    const saved = await resolveCheckinConflict(conflict.id, { resolution, note, resolvedBy: user?.id || null });
    setBusy("");
    if (!saved) {
      toast.error("Couldn't save the review.");
      return;
    }
    toast.success(resolution === "keep_first" ? "Kept the first admission." : "Marked reviewed.");
    onSaved(saved);
  };

  const reopen = async () => {
    setBusy("reopen");
    const saved = await reopenCheckinConflict(conflict.id);
    setBusy("");
    if (!saved) {
      toast.error("Couldn't reopen the conflict.");
      return;
    }
    onSaved(saved);
  };

  return (
    <Dialog open={!!conflict} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{conflict?.attendeeName || "Unnamed ticket"}</DialogTitle>
          <DialogDescription>{KIND_HELP[conflict?.kind] || ""}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <StatusPill status={conflict?.kind} map={CONFLICT_KIND_MAP} />
            {conflict?.ticketCode ? <span className="font-mono">{conflict.ticketCode}</span> : null}
            {conflict?.zone ? <span>· {conflict.zone}</span> : null}
            {conflict?.reason && conflict.kind === "invalid_ticket" ? <span>· {conflict.reason}</span> : null}
            {conflict?.cap !== null && conflict?.cap !== undefined ? (
              <span>
                · {conflict.occupancy} / {conflict.cap} inside
              </span>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {duplicateKind ? (
              <Admission
                label="Kept admission"
                at={conflict?.firstAt}
                gate={conflict?.firstGate}
                device={deviceName(devicesById, conflict?.firstDeviceId)}
                offline={conflict?.firstOffline}
              />
            ) : null}
            <Admission
              label={duplicateKind ? "Second admission" : "Offline admission"}
              at={conflict?.scannedAt}
              gate={conflict?.gate}
              device={deviceName(devicesById, conflict?.deviceId)}
              offline
            />
          </div>

          {conflict?.status === "resolved" ? (
            <p className="text-sm text-text-secondary">
              {RESOLUTION_LABELS[conflict.resolution] || "Resolved"} {conflict.resolvedAt ? `· ${clockTime(conflict.resolvedAt)}` : ""}
              {conflict.note ? <span className="mt-1 block text-foreground">{conflict.note}</span> : null}
            </p>
          ) : (
            <Field label="Note" hint="Optional — what happened at the door.">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Guest's partner used the forwarded ticket" />
            </Field>
          )}
        </div>

        <DialogFooter>
          {conflict?.status === "resolved" ? (
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={reopen}
              disabled={!!busy}
            >
              {busy === "reopen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reopen
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={() => resolve("reviewed")}
                disabled={!!busy}
              >
                {busy === "reviewed" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Mark reviewed
              </Button>
              {duplicateKind ? (
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => resolve("keep_first")} disabled={!!busy}>
                  {busy === "keep_first" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Keep first admission
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConflictsTab({ conflicts, devicesById, onChange }) {
  const [filter, setFilter] = useState("open");
  const [reviewing, setReviewing] = useState(null);

  const rows = useMemo(
    () => conflicts.filter((c) => filter === "all" || c.status === filter),
    [conflicts, filter],
  );

  const columns = [
    {
      key: "ticket",
      header: "Ticket",
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{c.attendeeName || "Unnamed ticket"}</p>
          <p className="truncate text-xs text-text-secondary">
            <span className="font-mono">{c.ticketCode || "—"}</span>
            {c.zone ? ` · ${c.zone}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Issue",
      className: "whitespace-nowrap",
      render: (c) => <StatusPill status={c.kind} map={CONFLICT_KIND_MAP} />,
    },
    {
      key: "first",
      header: "Kept admission",
      className: "text-sm text-text-secondary",
      render: (c) =>
        c.firstAt ? (
          <div>
            <p className="text-foreground">{clockTime(c.firstAt)}</p>
            <p className="text-xs">{[c.firstGate, deviceName(devicesById, c.firstDeviceId)].filter(Boolean).join(" · ")}</p>
          </div>
        ) : (
          "—"
        ),
    },
    {
      key: "second",
      header: "Offline admission",
      className: "text-sm text-text-secondary",
      render: (c) => (
        <div>
          <p className="text-foreground">{clockTime(c.scannedAt) || "—"}</p>
          <p className="text-xs">{[c.gate, deviceName(devicesById, c.deviceId)].filter(Boolean).join(" · ")}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      render: (c) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill status={c.status} map={CONFLICT_STATUS_MAP} />
          {c.resolution ? <span className="text-[11px] text-text-tertiary">{RESOLUTION_LABELS[c.resolution]}</span> : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (c) => (
        <Button
          size="sm"
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={() => setReviewing(c)}
        >
          {c.status === "open" ? "Review" : "View"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={filter} onValueChange={setFilter} options={CONFLICT_FILTER_OPTIONS} height="h-9" />
        </div>
      </Toolbar>
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(c) => c.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={GitCompareArrows}
              title={conflicts.length ? "Nothing here" : "No conflicts"}
              description={
                conflicts.length
                  ? "No conflicts match this filter."
                  : "When two offline devices admit the same ticket, or an offline admit breaks a rule, it lands here for review."
              }
            />
          </div>
        }
      />
      {reviewing ? (
        <ReviewDialog
          key={reviewing.id}
          conflict={reviewing}
          devicesById={devicesById}
          onOpenChange={(open) => !open && setReviewing(null)}
          onSaved={(saved) => {
            onChange(conflicts.map((c) => (c.id === saved.id ? saved : c)));
            setReviewing(null);
          }}
        />
      ) : null}
    </div>
  );
}

export default ConflictsTab;
