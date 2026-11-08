"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "@geiger/ui";
import { Field } from "@/components/internal/shared/screen_kit";

// Hands a booth to an exhibitor for one event without an order (sponsor allocation, offline deal) — a "comp" assignment.
export function AssignBoothDialog({ target, onOpenChange, onAssign }) {
  const [draft, setDraft] = useState(() => ({ name: "", email: "", price: target?.booth?.price || "", note: "" }));
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const submit = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    const ok = await onAssign(target, {
      name: draft.name.trim(),
      email: draft.email.trim(),
      price: Number(draft.price) || 0,
      note: draft.note.trim(),
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign booth {target?.booth?.code || ""}</DialogTitle>
          <DialogDescription>
            Gives the booth to an exhibitor for {target?.event?.name || "this event"} without a checkout — it comes off sale
            straight away.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Exhibitor">
            <Input autoFocus value={draft.name} onChange={set("name")} placeholder="Company or contact name" />
          </Field>
          <Field label="Email">
            <Input type="email" value={draft.email} onChange={set("email")} placeholder="name@company.com" />
          </Field>
          <Field label="Agreed price" hint="Recorded on the assignment; nothing is charged.">
            <Input type="number" inputMode="decimal" min={0} value={draft.price} onChange={set("price")} className="tabular-nums" />
          </Field>
          <Field label="Note">
            <Textarea rows={2} value={draft.note} onChange={set("note")} placeholder="e.g. Gold sponsor allocation" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy || !draft.name.trim()}
            onClick={submit}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Assign booth
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssignBoothDialog;
