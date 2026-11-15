"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch,
} from "@geiger/ui";
import { toast } from "sonner";
import { workspaceApi } from "@/lib/workspace/client";
import { plural } from "../state/format";

export const ticketFieldsOf = (fields) => fields.filter((field) => field.type === "link_event" && field.config?.target === "ticket");

// Links everyone on a list to the registration with the same email, in one go.
export function MatchTicketsDialog({ open, onOpenChange, eventId, object, fields, onDone }) {
  const tickets = ticketFieldsOf(fields);
  const emails = fields.filter((field) => field.type === "email");
  const [fieldId, setFieldId] = useState(tickets[0]?.id ?? null);
  const [emailFieldId, setEmailFieldId] = useState(emails[0]?.id ?? null);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const { data, error } = await workspaceApi.matchTickets(eventId, { objectId: object.id, fieldId, emailFieldId, overwrite });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const parts = [`Linked ${plural(data.matched, object.name.toLowerCase(), object.plural.toLowerCase())}`];
    if (data.kept) parts.push(`${data.kept} already linked`);
    if (data.unmatched) parts.push(`${data.unmatched} without a ticket`);
    toast.success(parts.join(" · "));
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Match tickets by email</DialogTitle>
          <DialogDescription>Links each {object.name.toLowerCase()} to the event registration with the same email address. Each change is logged and can be undone.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs text-text-secondary">Ticket field</Label>
            <Select value={fieldId ?? ""} onValueChange={setFieldId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Add a ticket link field first" /></SelectTrigger>
              <SelectContent>{tickets.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-text-secondary">Match on</Label>
            <Select value={emailFieldId ?? ""} onValueChange={setEmailFieldId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Add an email field first" /></SelectTrigger>
              <SelectContent>{emails.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={overwrite} onCheckedChange={setOverwrite} />Replace tickets that are already linked</label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={run} disabled={busy || !fieldId || !emailFieldId}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Match tickets</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
