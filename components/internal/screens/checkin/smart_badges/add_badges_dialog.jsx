"use client";

import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, FileUp, ListOrdered, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { Field, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { createBatch, importBadges } from "@/lib/supabase/smart_badges";
import { parseBadgeList, validateBadgeRows, SKIP_REASON_LABELS } from "@/lib/smart_badges/import";
import { holderPayload, liveBadgesByHolder } from "@/lib/smart_badges/roster";
import { serialAt, serialRange } from "@/lib/smart_badges/uid";
import { plural } from "./constants";

const MODES = [
  { value: "list", label: "Paste or upload", icon: ClipboardPaste },
  { value: "serials", label: "Generate serials", icon: ListOrdered },
];

const CHUNK = 500;
const MAX_SERIALS = 10000;

const todayLabel = () =>
  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Resolve optional email / ticket-code / name columns to roster people without a live badge.
function resolveHolders(rows, roster, badges) {
  const live = liveBadgesByHolder(badges);
  const index = { code: new Map(), email: new Map(), name: new Map() };
  const add = (map, key, p) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  };
  for (const p of roster || []) {
    add(index.code, p.code, p);
    add(index.email, (p.email || "").toLowerCase(), p);
    add(index.name, (p.name || "").toLowerCase(), p);
  }
  const taken = new Set();
  // A code or email can cover several seats (multi-ticket orders, guests): take the next free one.
  const next = (map, key) => (map.get(key) || []).find((p) => !live.has(p.key) && !taken.has(p.key)) || null;
  return rows.map((row) => {
    const person =
      (row.code && next(index.code, row.code)) ||
      (row.email && next(index.email, row.email)) ||
      (row.name && next(index.name, row.name.toLowerCase())) ||
      null;
    if (!person) return { ...row, person: null };
    taken.add(person.key);
    return { ...row, person };
  });
}

function AddBadgesBody({ eventId, projectId, userId, batches, badges, roster, onClose, onDone }) {
  const [mode, setMode] = useState("list");
  const [text, setText] = useState("");
  const [target, setTarget] = useState("new");
  const [name, setName] = useState(`Badges ${todayLabel()}`);
  const [prefix, setPrefix] = useState("");
  const [start, setStart] = useState("1");
  const [digits, setDigits] = useState("4");
  const [count, setCount] = useState(String(Math.max(roster?.length || 0, 100)));
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const checked = useMemo(() => {
    if (mode !== "list") return null;
    const result = validateBadgeRows(parseBadgeList(text), badges);
    const ready = resolveHolders(result.ready, roster, badges);
    return { ...result, ready, binding: ready.filter((r) => r.person).length };
  }, [mode, text, badges, roster]);

  const serialCount = Math.min(MAX_SERIALS, Math.max(0, Math.floor(Number(count) || 0)));
  const serialClash = useMemo(() => {
    if (mode !== "serials" || !serialCount) return 0;
    const existing = new Set(badges.map((b) => b.serial).filter(Boolean));
    return serialRange({ prefix, start, digits, count: serialCount }).filter((s) => existing.has(s)).length;
  }, [mode, prefix, start, digits, serialCount, badges]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsText(file);
  };

  const submit = async () => {
    let rows;
    if (mode === "list") {
      if (!checked?.ready.length) {
        toast.error("Nothing new to add — check the list for duplicates.");
        return;
      }
      rows = checked.ready.map((r) => ({
        uid: r.uid,
        serial: r.serial,
        ...(r.person ? holderPayload(r.person) : {}),
      }));
    } else {
      if (!serialCount) {
        toast.error("Set how many badges to generate.");
        return;
      }
      if (serialClash) {
        toast.error(`${plural(serialClash, "serial")} in that range already exist — change the prefix or start.`);
        return;
      }
      rows = serialRange({ prefix, start, digits, count: serialCount }).map((serial) => ({ serial }));
    }

    setBusy(true);
    let batchId = target !== "new" ? target : null;
    if (target === "new") {
      const batch = await createBatch({
        projectId,
        eventId,
        name: name.trim() || `Badges ${todayLabel()}`,
        source: mode === "serials" ? "generated" : "import",
        badgeCount: rows.length,
        serialPrefix: mode === "serials" ? prefix : "",
        serialStart: mode === "serials" ? Number(start) || 0 : null,
        serialDigits: mode === "serials" ? Number(digits) || 0 : null,
        createdBy: userId,
      });
      if (!batch) {
        setBusy(false);
        toast.error("Couldn't create the batch.");
        return;
      }
      batchId = batch.id;
    }

    let created = 0;
    let attached = 0;
    const skipped = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const res = await importBadges(eventId, batchId, rows.slice(i, i + CHUNK));
      if (!res?.ok) {
        setBusy(false);
        toast.error(created || attached ? `Stopped part-way — ${plural(created + attached, "badge")} saved.` : "Couldn't add the badges.");
        onDone();
        return;
      }
      created += Number(res.created) || 0;
      attached += Number(res.attached) || 0;
      skipped.push(...(res.skipped || []));
    }
    setBusy(false);
    const parts = [];
    if (created) parts.push(`${plural(created, "badge")} added`);
    if (attached) parts.push(`${plural(attached, "UID")} matched to serials`);
    if (skipped.length) {
      const why = SKIP_REASON_LABELS[skipped[0].reason] || "duplicate";
      parts.push(`${skipped.length} skipped (${why})`);
    }
    toast.success(parts.join(", ") || "Nothing changed.");
    onDone();
    onClose();
  };

  return (
    <>
      <div className="grid gap-4">
        <SegmentedTabs tabs={MODES} value={mode} onChange={setMode} fullWidth />

        {mode === "list" ? (
          <>
            <Field
              label="Chip UIDs"
              hint="One per line. Use serial,uid pairs to label badges, or paste a CSV with a header (uid, serial, and optionally email or ticket_code to bind straight away)."
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"04A21F9C\n04B3302A\n\nor\n\nserial,uid\nEVT-0001,04A21F9C"}
                className="h-40 bg-surface-card font-mono text-xs"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <FileUp className="h-4 w-4" /> Load CSV file
              </Button>
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
              {checked && checked.rows.length ? (
                <p className="text-xs text-text-secondary">
                  {[
                    checked.summary.create ? `${checked.summary.create} new` : null,
                    checked.summary.attach ? `${checked.summary.attach} match existing serials` : null,
                    checked.binding ? `${checked.binding} bind to attendees` : null,
                    checked.summary.duplicate ? `${checked.summary.duplicate} repeated in the list` : null,
                    checked.summary.existing ? `${checked.summary.existing} already issued` : null,
                    checked.summary.empty ? `${checked.summary.empty} empty` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Prefix" hint="Optional.">
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="EVT-" className="bg-surface-card" />
              </Field>
              <Field label="Start at">
                <Input type="number" min={0} value={start} onChange={(e) => setStart(e.target.value)} className="bg-surface-card" />
              </Field>
              <Field label="Digits">
                <Input type="number" min={0} max={10} value={digits} onChange={(e) => setDigits(e.target.value)} className="bg-surface-card" />
              </Field>
              <Field label="Count" hint={`${roster?.length || 0} on the roster`}>
                <Input type="number" min={1} max={MAX_SERIALS} value={count} onChange={(e) => setCount(e.target.value)} className="bg-surface-card" />
              </Field>
            </div>
            <p className="font-mono text-xs text-text-tertiary">
              {serialCount
                ? `${serialAt(prefix, start, digits, 0)} … ${serialAt(prefix, start, digits, serialCount - 1)}`
                : "Set a count above zero."}
              {serialClash ? ` · ${plural(serialClash, "clash", "clashes")} with existing serials` : ""}
            </p>
            <p className="text-xs text-text-secondary">
              Serials are printed on the badge before chips are known. Auto-assign them to attendees for the printer, then
              load the vendor&apos;s serial,uid file here to record each chip — or capture UIDs at the binding desk.
            </p>
          </>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Batch">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New batch</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {target === "new" ? (
            <Field label="Batch name">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-surface-card" />
            </Field>
          ) : null}
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "serials"
            ? `Generate ${serialCount ? plural(serialCount, "badge") : "badges"}`
            : checked?.ready.length
              ? `Add ${plural(checked.ready.length, "badge")}`
              : "Add badges"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AddBadgesDialog({ open, onOpenChange, ...rest }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add badges</DialogTitle>
          <DialogDescription>
            Load the chip UIDs your vendor shipped, or pre-number a serial range to print before the chips are known.
            Duplicates are skipped.
          </DialogDescription>
        </DialogHeader>
        {open ? <AddBadgesBody {...rest} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export default AddBadgesDialog;
