"use client";

import { useEffect, useState } from "react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@geiger/ui";
import { newId, workspaceApi } from "@/lib/workspace/client";
import { recordLabel } from "../state/format";
import { Muted } from "../ws_ui";

const ANY = "__any__";
const SAMPLE = "__sample__";

export const newBlockId = () => `b_${newId().replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 10)}`;

// The list a template is written for; its fields become the placeholders.
export function ListPicker({ data, value, onChange, allowAny = true }) {
  return (
    <Select value={value ?? ANY} onValueChange={(next) => onChange(next === ANY ? null : next)}>
      <SelectTrigger className="h-9" aria-label="List"><SelectValue /></SelectTrigger>
      <SelectContent>
        {allowAny ? <SelectItem value={ANY}><Muted>No list (event only)</Muted></SelectItem> : null}
        {data.objects.filter((object) => !object.deletedAt).map((object) => <SelectItem key={object.id} value={object.id}>For {object.plural.toLowerCase()}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// Sample values or one of the list's latest records, for previews.
export function RecordPicker({ eventId, object, objectId, value, onChange }) {
  const [state, setState] = useState({ key: null, rows: [] });
  useEffect(() => {
    if (!objectId) return undefined;
    const controller = new AbortController();
    workspaceApi.records(eventId, objectId, { limit: 25, sort: [{ field: "number", dir: "desc" }] }, controller.signal)
      .then(({ data }) => { if (!controller.signal.aborted) setState({ key: objectId, rows: data?.rows ?? [] }); }).catch(() => {});
    return () => controller.abort();
  }, [eventId, objectId]);
  const rows = state.key === objectId ? state.rows : [];
  return (
    <Select value={value ?? SAMPLE} onValueChange={(next) => onChange(next === SAMPLE ? null : next)} disabled={!objectId}>
      <SelectTrigger className="h-9" aria-label="Preview with"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={SAMPLE}>Preview with sample values</SelectItem>
        {rows.map((row) => <SelectItem key={row.id} value={row.id}>Preview for {recordLabel(object, row)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function DiscardDialog({ open, onOpenChange, onDiscard }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>Your changes to this document haven&apos;t been saved.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep editing</Button>
          <Button variant="destructive" onClick={() => { onOpenChange(false); onDiscard(); }}>Discard changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
