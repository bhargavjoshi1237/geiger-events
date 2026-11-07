"use client";

import React, { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Field } from "@/components/internal/shared/screen_kit";

// Supervisor admit past a hard cap. The reason is stored with the override in Capacity Control.
export function CapacityOverrideDialog({ target, onOpenChange, onConfirm }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const zone = target?.zone || "The venue";

  const close = (open) => {
    if (!open) setReason("");
    onOpenChange?.(open);
  };

  const confirm = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    await onConfirm?.(reason.trim());
    setBusy(false);
    setReason("");
  };

  return (
    <Dialog open={!!target} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Admit past the cap?</DialogTitle>
          <DialogDescription>
            {zone} is at {Number(target?.occupancy || 0).toLocaleString("en-US")} /{" "}
            {Number(target?.cap || 0).toLocaleString("en-US")}. Admitting {target?.name || "this guest"}
            {target?.party > 1 ? ` (party of ${target.party})` : ""} is recorded as a capacity override.
          </DialogDescription>
        </DialogHeader>
        <Field label="Reason" hint="Required — shown in the override log.">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), confirm())}
            placeholder="e.g. Replacing a guest who just left"
            autoFocus
          />
        </Field>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => close(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy || !reason.trim()}
            onClick={confirm}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Override & admit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CapacityOverrideDialog;
