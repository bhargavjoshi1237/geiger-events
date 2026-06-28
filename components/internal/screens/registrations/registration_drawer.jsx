"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Check, Trash2, Users, X } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOURCE_MAP, formatDateTime, initials } from "./constants";

export const STATUS_VALUES = [
  "Confirmed",
  "Pending",
  "Waitlisted",
  "Checked-in",
  "Declined",
  "Cancelled",
];

const EMPTY_DRAFT = {
  name: "",
  email: "",
  phone: "",
  eventId: "",
  status: "Confirmed",
  partySize: 1,
  dietary: "",
  accessibility: "",
};

// Quick-look + edit panel for a single registration. Reused by the per-event
// roster and the hub. Actions are passed in so the host owns persistence.
export function RegistrationDrawer({
  reg,
  eventName,
  onStatusChange,
  onDelete,
  onClose,
}) {
  if (!reg) return null;
  const answers =
    reg.answers && typeof reg.answers === "object" ? reg.answers : {};
  const answerEntries = Object.entries(answers).filter(
    ([, v]) => v !== "" && v != null && v !== false,
  );

  return (
    <Sheet open={!!reg} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-sm font-semibold text-foreground">
              {initials(reg.name) || "?"}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">{reg.name || "Unnamed"}</SheetTitle>
              <SheetDescription className="truncate">
                {reg.email || "No email"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Quick actions for the common transitions. */}
          <div className="flex flex-wrap gap-2">
            {reg.status === "Pending" ? (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-500/90 text-white hover:bg-emerald-500"
                  onClick={() => onStatusChange(reg, "Confirmed")}
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => onStatusChange(reg, "Declined")}
                >
                  <X className="h-4 w-4" /> Decline
                </Button>
              </>
            ) : null}
            {reg.status === "Confirmed" ? (
              <Button
                size="sm"
                className="bg-sky-500/90 text-white hover:bg-sky-500"
                onClick={() => onStatusChange(reg, "Checked-in")}
              >
                <Check className="h-4 w-4" /> Check in
              </Button>
            ) : null}
            {reg.status === "Waitlisted" ? (
              <Button
                size="sm"
                className="bg-emerald-500/90 text-white hover:bg-emerald-500"
                onClick={() => onStatusChange(reg, "Confirmed")}
              >
                <Check className="h-4 w-4" /> Promote
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
            <DetailItem label="Event" value={eventName} />
            <DetailItem label="Source">
              <Badge variant={SOURCE_MAP[reg.source]?.variant || "neutral"}>
                {reg.source}
              </Badge>
            </DetailItem>
            <DetailItem label="Registered" value={formatDateTime(reg.createdAt)} />
            <DetailItem label="Party size" value={String(reg.partySize)} />
            {reg.phone ? <DetailItem label="Phone" value={reg.phone} /> : null}
            {reg.waitlistPosition ? (
              <DetailItem label="Waitlist #" value={String(reg.waitlistPosition)} />
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              Status
            </p>
            <Select value={reg.status} onValueChange={(v) => onStatusChange(reg, v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reg.plusOnes?.length ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                <Users className="h-3.5 w-3.5" /> Plus-ones ({reg.plusOnes.length})
              </p>
              <div className="space-y-1.5">
                {reg.plusOnes.map((g, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground"
                  >
                    {g.name || "Guest"}
                    {g.email ? (
                      <span className="text-text-secondary"> · {g.email}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {reg.dietary || reg.accessibility ? (
            <div className="space-y-3">
              {reg.dietary ? <DetailBlock label="Dietary" value={reg.dietary} /> : null}
              {reg.accessibility ? (
                <DetailBlock label="Accessibility" value={reg.accessibility} />
              ) : null}
            </div>
          ) : null}

          {answerEntries.length ? (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                Form answers
              </p>
              <div className="space-y-1.5">
                {answerEntries.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 text-sm">
                    <span className="text-text-secondary">{k}</span>
                    <span className="text-right text-foreground">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end border-t border-border p-4">
          <Button
            size="sm"
            variant="ghost"
            className="text-red-300 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => onDelete(reg)}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ label, value, children }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
        {label}
      </p>
      <div className="mt-0.5 text-foreground">{children || value || "—"}</div>
    </div>
  );
}

function DetailBlock({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-surface-card px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  );
}

// Add a registrant by hand (comps / VIP / phone signups → source Organizer).
// When `fixedEvent` is passed the event is locked (per-event roster); otherwise
// the organizer picks one.
export function AddRegistrantDialog({
  open,
  onOpenChange,
  events,
  fixedEvent,
  onCreate,
}) {
  const [draft, setDraft] = useState({
    ...EMPTY_DRAFT,
    eventId: fixedEvent?.id || "",
  });
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  // Re-seed the locked event when reopened against a different one.
  const [seed, setSeed] = useState(fixedEvent?.id);
  if (fixedEvent?.id !== seed) {
    setSeed(fixedEvent?.id);
    setDraft((d) => ({ ...d, eventId: fixedEvent?.id || "" }));
  }

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Add the registrant's name first.");
      return;
    }
    if (!draft.eventId) {
      toast.error("Pick which event they're registering for.");
      return;
    }
    onCreate({ ...draft, partySize: Number(draft.partySize) || 1 });
    setDraft({ ...EMPTY_DRAFT, eventId: fixedEvent?.id || "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-background">
        <DialogHeader>
          <DialogTitle>Add registrant</DialogTitle>
          <DialogDescription>
            {fixedEvent
              ? `Add someone to ${fixedEvent.name} — comps, VIPs, or phone signups.`
              : "Register someone on their behalf — comps, VIPs, or phone signups."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Full name" htmlFor="reg-name">
            <Input
              id="reg-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Jordan Lee"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="jordan@example.com"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={draft.phone}
                onChange={(e) => set("phone")(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>

          {fixedEvent ? null : (
            <Field label="Event">
              <Select value={draft.eventId} onValueChange={set("eventId")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <Select value={draft.status} onValueChange={set("status")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Party size">
              <Input
                type="number"
                min={1}
                value={draft.partySize}
                onChange={(e) => set("partySize")(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Dietary needs">
              <Input
                value={draft.dietary}
                onChange={(e) => set("dietary")(e.target.value)}
                placeholder="e.g. Vegetarian"
              />
            </Field>
            <Field label="Accessibility needs">
              <Input
                value={draft.accessibility}
                onChange={(e) => set("accessibility")(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Add registrant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// A delete-confirmation dialog shared across the registration screens.
export function RemoveRegistrationDialog({ target, onCancel, onConfirm }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove registration</DialogTitle>
          <DialogDescription>
            Remove{" "}
            <span className="font-medium text-foreground">{target?.name}</span> from
            this event? This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-red-500/90 text-white hover:bg-red-500"
            onClick={() => onConfirm(target)}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
