"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BellRing,
  Building2,
  Hotel,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { DataTable, EmptyState, Field, SectionCard, StatusPill } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { ActionMenu } from "@geiger/ui/action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { LoadingArea } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { formatMoney, isEmail } from "@/lib/sourcing/rfp_model";
import { rankCandidates } from "@/lib/sourcing/suggest";

import { RECIPIENT_STATUS_MAP, SOURCE_LABELS, recipientDisplayStatus, relativeTime } from "./constants";

const SUGGESTION_PAGE = 6;

const EMPTY_CONTACT = { name: "", contactName: "", email: "" };

// Remounted by key per use, so its draft always starts from `initial`.
function ContactDialog({ open, initial, title, description, submitLabel, onOpenChange, onSubmit }) {
  const [draft, setDraft] = useState(initial || EMPTY_CONTACT);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!String(draft?.name || "").trim()) {
      toast.error("Add the venue or company name.");
      return;
    }
    if (!isEmail(draft?.email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit(draft);
    setBusy(false);
    if (ok) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field label="Venue or company">
            <Input value={draft?.name || ""} onChange={set("name")} placeholder="e.g. Riverside Hall" />
          </Field>
          <Field label="Contact name">
            <Input value={draft?.contactName || ""} onChange={set("contactName")} placeholder="Optional" />
          </Field>
          <Field label="Email" hint="Where the private response link goes.">
            <Input type="email" value={draft?.email || ""} onChange={set("email")} placeholder="events@venue.com" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionRow({ c, onAdd, disabled }) {
  const Icon = c.kind === "Hotel" || c.kind === "Apartment" ? Hotel : c.source === "venue" ? Building2 : MapPin;
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
          <Badge variant="neutral">{c.source === "venue" ? "Venues book" : c.kind}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">{c.reasons.join(" · ")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden w-20 sm:block" title={`Fit score ${c.score}/100`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-card">
            <div className="h-full rounded-full bg-primary" style={{ width: `${c.score}%` }} />
          </div>
          <p className="mt-1 text-right text-[11px] tabular-nums text-text-tertiary">{c.score}/100</p>
        </div>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAdd(c)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

export function RecipientsSection({
  rfp,
  recipients,
  currentBids,
  candidates,
  history,
  suggestionsLoading,
  now,
  busy,
  onAdd,
  onUpdate,
  onRemove,
  onSend,
}) {
  const [showAll, setShowAll] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualKey, setManualKey] = useState(0);
  const [editTarget, setEditTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const final = rfp.status === "awarded" || rfp.status === "cancelled";
  const live = rfp.status === "sent";
  const canAdd = !final;

  const ranked = useMemo(
    () => (candidates ? rankCandidates({ rfp, candidates, recipients, history }) : []),
    [rfp, candidates, recipients, history],
  );
  const shown = showAll ? ranked : ranked.slice(0, SUGGESTION_PAGE);
  const topContactable = ranked.filter((c) => c.contactable).slice(0, 5);

  const addCandidates = async (list) => {
    const ok = await onAdd(
      list.map((c) => ({
        source: c.source,
        venueId: c.venueId,
        pipelineRecordId: c.pipelineRecordId,
        name: c.name,
        contactName: c.contactName,
        email: c.email,
        details: c.details,
      })),
    );
    if (ok) {
      toast.success(list.length === 1 ? `Added ${list[0].name}.` : `Added ${list.length} venues.`);
      if (list.some((c) => !c.contactable)) toast.message("Some have no email yet — edit them to add one before sending.");
    }
  };

  const responded = recipients.filter((r) => ["responded", "awarded", "lost"].includes(r.status) && currentBids[r.id]).length;
  const invited = recipients.filter((r) => r.invitedAt).length;

  const columns = [
    {
      key: "venue",
      header: "Venue",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            {r.source === "manual" ? <Mail className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.name || "Unnamed"}</p>
            <p className={cn("truncate text-xs", isEmail(r.email) ? "text-text-secondary" : "text-amber-700 dark:text-amber-400")}>
              {[r.contactName, isEmail(r.email) ? r.email : "No email — edit to add one"].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (r) => <span className="text-sm text-text-secondary">{SOURCE_LABELS[r.source]}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="space-y-1">
          <StatusPill status={recipientDisplayStatus(r)} map={RECIPIENT_STATUS_MAP} />
          {r.status === "declined" && r.declineReason ? (
            <p className="max-w-[220px] truncate text-xs text-text-tertiary" title={r.declineReason}>
              “{r.declineReason}”
            </p>
          ) : r.viewedAt && r.status === "viewed" ? (
            <p className="text-xs text-text-tertiary">Opened {relativeTime(r.viewedAt, now)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "bid",
      header: "Bid",
      align: "right",
      className: "text-right tabular-nums",
      render: (r) => {
        const b = currentBids[r.id];
        return b ? (
          <div>
            <span className="font-semibold text-foreground">{formatMoney(b.total, b.currency)}</span>
            <span className="block text-xs text-text-tertiary">Revision {b.revision}</span>
          </div>
        ) : (
          <span className="text-text-tertiary">—</span>
        );
      },
    },
    {
      key: "email",
      header: "Last email",
      render: (r) => {
        const s = r.emailStatus || {};
        if (!s.status) return <span className="text-xs text-text-tertiary">—</span>;
        const label = { invitation: "Invite", reminder: "Reminder", award: "Award", regret: "Regret" }[s.kind] || "Email";
        return (
          <span
            title={s.error || undefined}
            className={cn(
              "text-xs",
              s.status === "sent" ? "text-text-secondary" : s.status === "failed" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-400",
            )}
          >
            {s.status === "sent" ? `${label} sent ${relativeTime(s.at, now)}` : s.status === "failed" ? `${label} failed` : `${label} not sent (off)`}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => {
        const sentOnce = Boolean(r.invitedAt);
        const waiting = ["invited", "viewed"].includes(r.status);
        const hasEmail = isEmail(r.email);
        return (
          <ActionMenu
            label={`Actions for ${r.name}`}
            items={[
              live && !sentOnce && { icon: Send, label: "Send invite", disabled: !hasEmail || busy, onSelect: () => onSend({ recipientIds: [r.id], mode: "invite" }) },
              live && sentOnce && waiting && { icon: BellRing, label: "Send reminder", disabled: !hasEmail || busy, onSelect: () => onSend({ recipientIds: [r.id], mode: "reminder" }) },
              live && sentOnce && !["awarded", "lost"].includes(r.status) && { icon: RotateCcw, label: "Resend new link", disabled: !hasEmail || busy, onSelect: () => onSend({ recipientIds: [r.id], mode: "invite" }) },
              !final && { icon: Pencil, label: "Edit contact", onSelect: () => setEditTarget(r) },
              !final && !currentBids[r.id] && { separator: true },
              !final && !currentBids[r.id] && { icon: Trash2, label: "Remove", destructive: true, onSelect: () => setRemoveTarget(r) },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {recipients.length} venue{recipients.length === 1 ? "" : "s"} · {invited} invited · {responded} with a bid
        </p>
        <div className="flex flex-wrap gap-2">
          {live && recipients.some((r) => r.invitedAt && ["invited", "viewed"].includes(r.status)) ? (
            <Button variant="outline" disabled={busy} onClick={() => onSend({ mode: "reminder" })}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Remind non-responders
            </Button>
          ) : null}
          {live && recipients.some((r) => !r.invitedAt && isEmail(r.email)) ? (
            <Button variant="outline" disabled={busy} onClick={() => onSend({ mode: "invite" })}>
              <Send className="h-4 w-4" /> Invite new venues
            </Button>
          ) : null}
          {canAdd ? (
            <Button
              variant="outline"
              onClick={() => {
                setManualKey((k) => k + 1);
                setManualOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" /> Add by email
            </Button>
          ) : null}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={recipients}
        getRowKey={(r) => r.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Users}
              title="No venues on this RFP yet"
              description="Add suggested venues below, or invite anyone by email."
            />
          </div>
        }
      />

      {canAdd ? (
        <SectionCard
          title="Suggested venues"
          description="Ranked from your Venues book and sourcing pipelines by capacity fit, location and how they've answered past RFPs."
          action={
            topContactable.length > 1 ? (
              <Button size="sm" variant="outline" onClick={() => addCandidates(topContactable)}>
                <Sparkles className="h-4 w-4" /> Add top {topContactable.length}
              </Button>
            ) : null
          }
        >
          {suggestionsLoading ? (
            <LoadingArea size={40} label="Loading suggestions" />
          ) : ranked.length ? (
            <div>
              <div className="divide-y divide-border">
                {shown.map((c) => (
                  <SuggestionRow key={c.key} c={c} onAdd={(x) => addCandidates([x])} />
                ))}
              </div>
              {ranked.length > SUGGESTION_PAGE ? (
                <Button variant="ghost" size="sm" className="mt-2 text-text-secondary" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show fewer" : `Show all ${ranked.length}`}
                </Button>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={MapPin}
              title="Nothing to suggest yet"
              description="Add venues to your Venues book or shortlist them in Venue Sourcing and they'll be ranked here."
            />
          )}
        </SectionCard>
      ) : null}

      <ContactDialog
        key={`manual-${manualKey}`}
        open={manualOpen}
        initial={EMPTY_CONTACT}
        title="Add a venue by email"
        description="For venues that aren't in your Venues book or pipeline yet."
        submitLabel="Add venue"
        onOpenChange={setManualOpen}
        onSubmit={async (d) => {
          if (recipients.some((r) => r.email && r.email.toLowerCase() === d.email.trim().toLowerCase())) {
            toast.error("That email is already on this RFP.");
            return false;
          }
          const ok = await onAdd([{ source: "manual", name: d.name, contactName: d.contactName, email: d.email, details: {} }]);
          if (ok) toast.success(`Added ${d.name}.`);
          return ok;
        }}
      />

      <ContactDialog
        key={`edit-${editTarget?.id || "none"}`}
        open={Boolean(editTarget)}
        initial={editTarget || EMPTY_CONTACT}
        title="Edit contact"
        description={editTarget?.invitedAt ? "Changing the email doesn't resend — use “Resend new link” afterwards." : "Who receives the RFP for this venue."}
        submitLabel="Save"
        onOpenChange={(o) => !o && setEditTarget(null)}
        onSubmit={async (d) => {
          const ok = await onUpdate(editTarget, { name: d.name, contactName: d.contactName, email: d.email });
          if (ok) toast.success("Contact saved.");
          return ok;
        }}
      />

      <Dialog open={Boolean(removeTarget)} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.name}?</DialogTitle>
            <DialogDescription>
              {removeTarget?.invitedAt ? "Their link stops working immediately. " : ""}You can add them again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={async () => {
                const target = removeTarget;
                setRemoveTarget(null);
                await onRemove(target);
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RecipientsSection;
