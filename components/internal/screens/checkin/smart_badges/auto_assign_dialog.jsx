"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Wand2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Button } from "@geiger/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { Field } from "@/components/internal/shared/screen_kit";
import { assignBadges } from "@/lib/supabase/smart_badges";
import { ROLE_FILTERS, holderPayload, planAutoAssign } from "@/lib/smart_badges/roster";
import { tiersOf } from "@/lib/passes/attendees";
import { badgeTitle, plural } from "./constants";

const ORDER_OPTIONS = [
  { value: "name", label: "Guest list order (A–Z)" },
  { value: "tier", label: "Ticket type, then name" },
];

const CHUNK = 500;

function Picker({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-surface-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function AutoAssignBody({ eventId, batches, badges, roster, initialBatchId, onClose, onDone }) {
  const withSpares = batches.filter((b) => badges.some((x) => x.batchId === b.id && x.status === "unassigned"));
  const [batchId, setBatchId] = useState(initialBatchId || withSpares[0]?.id || "all");
  const [role, setRole] = useState("attendees");
  const [tier, setTier] = useState("all");
  const [order, setOrder] = useState("name");
  const [busy, setBusy] = useState(false);

  const tiers = useMemo(() => tiersOf(roster), [roster]);
  const plan = useMemo(
    () => planAutoAssign({ badges, roster, batchId: batchId === "all" ? null : batchId, role, tier, order }),
    [badges, roster, batchId, role, tier, order],
  );

  const submit = async () => {
    if (!plan.pairs.length) {
      toast.error("Nothing to assign with these filters.");
      return;
    }
    setBusy(true);
    let assigned = 0;
    for (let i = 0; i < plan.pairs.length; i += CHUNK) {
      const res = await assignBadges(
        eventId,
        plan.pairs.slice(i, i + CHUNK).map(({ badge, person }) => ({ badge_id: badge.id, ...holderPayload(person) })),
      );
      if (!res?.ok) {
        setBusy(false);
        toast.error(assigned ? `Stopped part-way — ${plural(assigned, "badge")} assigned.` : "Couldn't assign the badges.");
        onDone();
        return;
      }
      assigned += Number(res.assigned) || 0;
    }
    setBusy(false);
    toast.success(`${plural(assigned, "badge")} assigned.`);
    onDone();
    onClose();
  };

  return (
    <>
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Picker
            label="Spare badges from"
            value={batchId}
            onChange={setBatchId}
            options={[{ value: "all", label: "Any batch" }, ...batches.map((b) => ({ value: b.id, label: b.name }))]}
          />
          <Picker label="Assign to" value={role} onChange={setRole} options={ROLE_FILTERS} />
          <Picker
            label="Ticket type"
            value={tier}
            onChange={setTier}
            options={[{ value: "all", label: "All ticket types" }, ...tiers.map((t) => ({ value: t, label: t }))]}
          />
          <Picker label="Order" value={order} onChange={setOrder} options={ORDER_OPTIONS} />
        </div>

        <div className="rounded-lg border border-border bg-surface-card px-4 py-3 text-sm">
          <p className="text-foreground">
            {plural(plan.spare, "spare badge")} · {plural(plan.waiting, "person", "people")} without a badge
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {plan.pairs.length
              ? `${plural(plan.pairs.length, "badge")} will be bound, in serial order.`
              : "Nothing matches — add badges or widen the filters."}
            {plan.waiting > plan.spare && plan.spare ? ` ${plan.waiting - plan.spare} will still need one.` : ""}
          </p>
        </div>

        {plan.pairs.length ? (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
            {plan.pairs.slice(0, 5).map(({ badge, person }) => (
              <div key={badge.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-28 shrink-0 truncate font-mono text-xs text-text-secondary">{badgeTitle(badge)}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                <span className="min-w-0 flex-1 truncate text-foreground">{person.name}</span>
                <span className="shrink-0 truncate text-xs text-text-tertiary">{person.tier || person.role}</span>
              </div>
            ))}
            {plan.pairs.length > 5 ? (
              <p className="px-3 py-2 text-xs text-text-tertiary">…and {plan.pairs.length - 5} more</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={busy || !plan.pairs.length}
          onClick={submit}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Assign {plan.pairs.length ? plural(plan.pairs.length, "badge") : ""}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AutoAssignDialog({ open, onOpenChange, ...rest }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Auto-assign badges</DialogTitle>
          <DialogDescription>
            Bind spare badges to everyone who doesn&apos;t have one yet. Export the result for your badge printer so each
            name lands on the right chip.
          </DialogDescription>
        </DialogHeader>
        {open ? <AutoAssignBody {...rest} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export default AutoAssignDialog;
