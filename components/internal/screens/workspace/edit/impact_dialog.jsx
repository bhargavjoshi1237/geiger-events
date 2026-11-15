"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@geiger/ui";
import { plural } from "../state/format";

// Shown before a field change that would clear existing values.
export function ImpactDialog({ impact, fieldName, onCancel, onConfirm }) {
  return (
    <Dialog open={Boolean(impact)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Some values can&apos;t be kept</DialogTitle>
          <DialogDescription>
            Changing {fieldName} will clear {plural(impact?.clears ?? 0, "value")}
            {impact?.converts ? ` and convert ${plural(impact.converts, "other")}` : ""}. Cleared values stay in the change log, and you can undo this straight after.
          </DialogDescription>
        </DialogHeader>
        {impact?.examples?.length ? (
          <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm">
            <p className="mb-1 text-text-secondary">For example:</p>
            <ul className="space-y-0.5">
              {impact.examples.map((example) => <li key={example.recordId} className="truncate text-foreground">“{example.from}”</li>)}
            </ul>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button className="bg-red-500/90 text-white hover:bg-red-500" onClick={onConfirm}>Change and clear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
