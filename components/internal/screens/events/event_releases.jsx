"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  Flame,
  Hand,
  Hourglass,
  Layers,
  RotateCcw,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";

import { EditorSectionHeader, EmptyState, Field } from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Input } from "@geiger/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@geiger/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { getSetting } from "@/lib/supabase/ticketing_settings";
import { defaultReleaseConfig } from "../tickets/constants";
import {
  WaveChainEditor,
  gateShort,
  validateReleases,
} from "../tickets/release_editor";
import {
  defaultRelease,
  getTicketReleases,
  newReleaseId,
  normalizeRelease,
  releaseSummaryForTicket,
  resolveTicketReleases,
} from "@/lib/events/ticket_releases";

// Solid status dot shown alongside the neutral wave number. The previous
// design tinted the whole number circle red/green per status, which read as
// an error/success badge and washed out the number itself — especially the
// sold-out rose and live emerald pair in the collapsed timeline.
function dotClassFor(status) {
  switch (status) {
    case "live":
      return "bg-emerald-500";
    case "soldout":
      return "bg-rose-500";
    case "scheduled":
      return "bg-sky-500";
    case "waiting_stockout":
    case "waiting_delay":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground/50";
  }
}

// One-line, plain-language status of a ticket: what's selling now and what
// happens next, e.g. "Wave 1 on sale — 66 left · Wave 2 opens when "Wave 1"
// sells out".
function summaryFor(ticket, state) {
  if (!state.hasReleases) {
    const qty = Number(ticket.qty) || 0;
    return qty > 0 ? `All ${qty} tickets on sale at once.` : "On sale now — no waves yet.";
  }
  const parts = [];
  const live = state.activeReleases[0];
  if (live) {
    parts.push(
      live.remaining === Infinity
        ? `${live.release.name} on sale`
        : `${live.release.name} on sale — ${live.remaining} left`,
    );
  } else {
    // Nothing selling right now — say what already finished so the line still
    // reads as a status, not a non-sequitur.
    const done = state.perRelease.filter((p) => p.soldOut).map((p) => p.release.name);
    if (done.length === 1) parts.push(`${done[0]} sold out`);
    else if (done.length > 1) parts.push(`${done.length} waves sold out`);
  }
  const nx = state.nextRelease;
  if (nx) {
    const idx = state.releases.findIndex((r) => String(r.id) === String(nx.release.id));
    parts.push(
      `${nx.release.name} ${nx.status === "paused" ? "is paused" : gateShort(nx.release, idx, state.releases)}`,
    );
  }
  if (!parts.length) parts.push("Sold out");
  return parts.join(" · ");
}

// Glanceable wave chain for a collapsed card: numbered, neutral chips joined
// by arrows — the number stays readable in both themes while a small dot
// carries the wave status (emerald = on sale, rose = sold out,
// amber = waiting, sky = scheduled, grey = not opened/paused/closed).
function MiniTimeline({ state }) {
  if (!state.hasReleases) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={`${state.releases.length} waves`}>
      {state.perRelease.map((p, i) => (
        <React.Fragment key={p.release.id}>
          {i > 0 ? <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" /> : null}
          <span
            title={`${p.release.name || `Wave ${i + 1}`} — ${Number(p.release.qty) || 0} tickets — ${
              p.soldOut ? "Sold out" : gateShort(p.release, i, state.releases)
            }`}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-subtle py-0.5 pl-1 pr-2.5 text-[11px]",
              p.soldOut ? "opacity-75" : "",
            )}
          >
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-[9px] font-bold tabular-nums text-foreground">
              {i + 1}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -bottom-px -right-px h-1.5 w-1.5 rounded-full ring-2 ring-surface-subtle",
                  dotClassFor(p.status),
                )}
              />
            </span>
            <span
              className={cn(
                "max-w-[8rem] truncate font-medium",
                p.soldOut ? "text-text-secondary line-through" : "text-foreground",
              )}
            >
              {p.release.name || `Wave ${i + 1}`}
            </span>
            <span className="shrink-0 tabular-nums text-text-secondary">{Number(p.release.qty) || 0}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// Destructive actions confirm in place — second click within a few seconds.
function ConfirmButton({ onConfirm, variant = "ghost", children, ...props }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      {...props}
      variant={armed ? "destructive" : variant}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? "Click again to confirm" : children}
    </Button>
  );
}

// First-run form for a ticket with no waves yet: one concrete split, chosen
// visually, instead of an abstract editor.
function SplitSetup({ ticket, defaultDelay, defaultQty, onStart, onCancel }) {
  const total = Number(ticket.qty) || 0; // 0 = unlimited
  const [firstQty, setFirstQty] = useState(() =>
    total > 0 ? Math.max(1, Math.ceil(total / 2)) : Math.max(1, Number(defaultQty) || 100),
  );
  const [secondQty, setSecondQty] = useState(() => Math.max(1, Number(defaultQty) || 100));
  const [openHow, setOpenHow] = useState("after_stockout");
  const [dateVal, setDateVal] = useState("");
  const [delay, setDelay] = useState(Math.max(0, Number(defaultDelay) || 0));

  const first = Math.max(0, Math.round(Number(firstQty) || 0));
  const second = total > 0 ? Math.max(0, total - first) : Math.max(0, Math.round(Number(secondQty) || 0));
  const effectiveTotal = total > 0 ? total : first + second;
  const valid = total > 0 ? first > 0 && first < total : first > 0 && second > 0;
  const dateValid = openHow !== "date" || dateVal.trim().length > 0;

  const openLine =
    openHow === "date"
      ? `opens ${
          dateVal
            ? new Date(dateVal).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : "on the date you pick"
        }`
      : openHow === "after_stockout"
        ? `opens ${delay > 0 ? `${delay} day${delay === 1 ? "" : "s"} after` : "the moment"} wave 1 sells out`
        : "stays hidden until you open it";

  const start = () => {
    if (!valid) {
      toast.error(
        total > 0
          ? "Split the total between both waves — wave 1 can't take it all."
          : "Give each wave at least 1 ticket.",
      );
      return;
    }
    if (!dateValid) {
      toast.error("Pick the date wave 2 opens.");
      return;
    }
    const r1 = { ...defaultRelease(0, first), id: newReleaseId(), name: "Wave 1", startMode: "now" };
    const r2 = {
      ...defaultRelease(1, second),
      id: newReleaseId(),
      name: "Wave 2",
      startMode: openHow,
      afterReleaseId: openHow === "after_stockout" ? r1.id : "",
      delayDays: openHow === "after_stockout" ? delay : 0,
      startAt: openHow === "date" ? dateVal : "",
      released: openHow !== "manual",
    };
    onStart(ticket.id, [r1, r2], effectiveTotal);
  };

  const options = [
    { value: "after_stockout", icon: Flame, title: "After wave 1 sells out", blurb: "Automatic — the moment stock runs out." },
    { value: "date", icon: CalendarClock, title: "On a specific date", blurb: "Opens by itself that day." },
    { value: "manual", icon: Hand, title: "When I say so", blurb: "Stays hidden until you release it." },
  ];

  return (
    <div className="space-y-4 border-t border-border p-3 sm:p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Split “{ticket.name || "Untitled ticket"}” into 2 waves
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {total > 0
            ? `${total} tickets — wave 1 sells first, wave 2 takes the rest.`
            : "This ticket is unlimited — set a size for each wave."}
        </p>
      </div>

      {/* Live picture of the split */}
      {total > 0 ? (
        <div className="space-y-1.5">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-active">
            <span
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${(first / Math.max(1, effectiveTotal)) * 100}%` }}
            />
            <span
              className="h-full bg-primary/30 transition-all duration-200"
              style={{ width: `${(second / Math.max(1, effectiveTotal)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] tabular-nums text-text-secondary">
            <span>Wave 1 · {first}</span>
            <span>Wave 2 · {second}</span>
          </div>
        </div>
      ) : null}

      {total > 0 ? (
        <Field label="Tickets in wave 1" hint={`Wave 2 gets the remaining ${second}.`}>
          <div className="flex max-w-xs items-center gap-2">
            <Input
              type="number"
              min={1}
              max={total - 1}
              value={firstQty}
              onChange={(e) => setFirstQty(e.target.value)}
              className="tabular-nums"
            />
            <span className="shrink-0 text-xs text-text-secondary">of {total}</span>
          </div>
        </Field>
      ) : (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Field label="Wave 1 tickets">
            <Input type="number" min={1} value={firstQty} onChange={(e) => setFirstQty(e.target.value)} className="tabular-nums" />
          </Field>
          <Field label="Wave 2 tickets">
            <Input type="number" min={1} value={secondQty} onChange={(e) => setSecondQty(e.target.value)} className="tabular-nums" />
          </Field>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">When does wave 2 open?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {options.map((o) => {
            const Icon = o.icon;
            const active = openHow === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setOpenHow(o.value)}
                aria-pressed={active}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
                  active ? "border-primary/60 bg-primary/5" : "border-border hover:border-border-strong",
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                <span>
                  <span className="block text-xs font-semibold text-foreground">{o.title}</span>
                  <span className="block text-[11px] text-text-secondary">{o.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {openHow === "date" ? (
        <Field label="Wave 2 opens on">
          <Input
            type="datetime-local"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            className={cn("max-w-xs", !dateValid ? "border-red-500" : "")}
          />
        </Field>
      ) : null}
      {openHow === "after_stockout" ? (
        <Field label="Wait after the sell-out" hint="0 opens it right away.">
          <div className="flex max-w-xs items-center gap-2">
            <Input
              type="number"
              min={0}
              value={delay}
              onChange={(e) => setDelay(Math.max(0, Number(e.target.value) || 0))}
              className="tabular-nums"
            />
            <span className="shrink-0 text-xs text-text-secondary">days</span>
          </div>
        </Field>
      ) : null}

      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs text-text-secondary">
        <Eye className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Buyers see: <strong className="text-foreground">Wave 1 ({first} tickets) on sale now</strong> · Wave 2{" "}
          {openLine}.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={start}>
          <Zap className="h-4 w-4" /> Start selling in waves
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Copy one ticket's waves onto others — the bulk manager, reduced to one clear
// dialog instead of a toolbar acting on hidden checkboxes.
function CopyWavesDialog({ source, waves, targets, sourceDirty, onApply, onClose }) {
  const [picked, setPicked] = useState(() => new Set());
  const total = waves.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copy waves to other tickets</DialogTitle>
          <DialogDescription>
            “{source.name || "This ticket"}” sells in {waves.length} wave{waves.length > 1 ? "s" : ""} —{" "}
            {total} tickets. Ticked tickets get exactly these waves; their current waves and sizes are
            replaced.
          </DialogDescription>
        </DialogHeader>

        {sourceDirty ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
            Includes this ticket&apos;s unsaved changes.
          </p>
        ) : null}

        <div className="space-y-1">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              Apply to
            </span>
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline"
              onClick={() =>
                setPicked((p) =>
                  p.size === targets.length ? new Set() : new Set(targets.map((t) => t.id)),
                )
              }
            >
              {picked.size === targets.length ? "Clear all" : "Tick all"}
            </button>
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
            {targets.map((t) => {
              const rel = getTicketReleases(t);
              return (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:bg-surface-active"
                >
                  <Checkbox
                    checked={picked.has(t.id)}
                    onCheckedChange={() => toggle(t.id)}
                    aria-label={`Copy waves to ${t.name || "ticket"}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {t.name || "Untitled ticket"}
                  </span>
                  <span className="shrink-0 text-[11px] text-text-secondary">
                    {rel.length ? `${rel.length} wave${rel.length > 1 ? "s" : ""} now` : "no waves yet"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button size="sm" disabled={!picked.size} onClick={() => onApply([...picked])}>
            <Copy className="h-4 w-4" /> Copy to {picked.size ? `${picked.size} ticket${picked.size > 1 ? "s" : ""}` : "…"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Bulk setup: copy one ticket's waves onto all or selected tickets at once,
// or clear waves from several tickets in one go. Lives in a collapsed
// accordion so the per-ticket cards stay the focus; bulk work is one
// deliberate expand + apply.
function BulkWavesCard({ list, wavesOf, drafts, onBulkCopy, onBulkRemove, onSplitAll }) {
  const withWaves = list.filter((t) => (wavesOf(t) || []).length > 0);
  const [sourceId, setSourceId] = useState(() => withWaves[0]?.id ?? null);
  const [picked, setPicked] = useState(() => new Set());

  // The chosen source may lose its waves (or leave the list) — fall back to
  // the first ticket that still has waves.
  const effectiveSourceId = withWaves.some((t) => String(t.id) === String(sourceId))
    ? sourceId
    : (withWaves[0]?.id ?? null);
  const source = list.find((t) => String(t.id) === String(effectiveSourceId)) || null;
  const sourceWaves = source ? wavesOf(source) || [] : [];
  const sourceTotal = sourceWaves.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const sourceDirty =
    source &&
    source.id in (drafts || {}) &&
    JSON.stringify((drafts[source.id] || []).map((r) => normalizeRelease(r))) !==
      JSON.stringify(getTicketReleases(source));

  const targets = list.filter((t) => String(t.id) !== String(effectiveSourceId));
  // A picked ticket removed from the list (or promoted to source) drops out.
  const pickedIds = [...picked].filter((id) => targets.some((t) => String(t.id) === String(id)));
  const pickedSet = new Set(pickedIds.map(String));

  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set([...p].map(String));
      const key = String(id);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      // Store raw ids back so callers can match either type.
      return new Set([...n].map((k) => targets.find((t) => String(t.id) === k)?.id ?? k));
    });

  const tickAll = () =>
    setPicked(
      pickedIds.length === targets.length ? new Set() : new Set(targets.map((t) => t.id)),
    );
  const tickBlank = () =>
    setPicked(new Set(targets.filter((t) => getTicketReleases(t).length === 0).map((t) => t.id)));

  const withoutWaves = list.filter((t) => getTicketReleases(t).length === 0).length;

  return (
    <Accordion type="single" collapsible>
      <AccordionItem
        value="bulk"
        className="rounded-xl border border-border bg-surface-card px-3 sm:px-4"
      >
        <AccordionTrigger className="py-3 hover:no-underline">
          <span className="flex min-w-0 items-center gap-2 text-left">
            <Users className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                Apply to multiple tickets at once
              </span>
              <span className="block truncate text-[11px] font-normal text-text-secondary">
                {withWaves.length
                  ? `Copy one ticket's waves onto all or selected tickets`
                  : withoutWaves
                    ? `${withoutWaves} ticket${withoutWaves > 1 ? "s" : ""} without waves`
                    : "Copy or clear waves in bulk"}
              </span>
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {!withWaves.length ? (
            <div className="space-y-3 pb-1">
              <p className="text-xs text-text-secondary">
                No ticket has waves yet — set up waves on one ticket above, then copy
                them here. Or split every ticket without waves into 2 waves right now.
              </p>
              <Button size="sm" onClick={onSplitAll} disabled={!withoutWaves}>
                <Zap className="h-4 w-4" /> Split {withoutWaves || "all"} ticket
                {withoutWaves === 1 ? "" : "s"} into 2 waves
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pb-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                    Copy waves from
                  </p>
                  <Select
                    value={effectiveSourceId != null ? String(effectiveSourceId) : ""}
                    onValueChange={(v) => {
                      setSourceId(list.find((t) => String(t.id) === v)?.id ?? v);
                      setPicked(new Set());
                    }}
                  >
                    <SelectTrigger className="bg-surface-subtle">
                      <SelectValue placeholder="Pick a ticket" />
                    </SelectTrigger>
                    <SelectContent>
                      {withWaves.map((t) => {
                        const w = wavesOf(t) || [];
                        const total = w.reduce((s, r) => s + (Number(r.qty) || 0), 0);
                        return (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name || "Untitled ticket"} · {w.length} wave
                            {w.length > 1 ? "s" : ""} · {total} tickets
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {source ? (
                    <p className="text-[11px] text-text-secondary">
                      “{source.name || "This ticket"}” sells in {sourceWaves.length} wave
                      {sourceWaves.length > 1 ? "s" : ""} — {sourceTotal} tickets
                      {sourceDirty ? " (includes its unsaved edits)" : ""}. Targets get
                      exactly these waves; their current waves are replaced.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                      Apply to
                    </p>
                    <div className="flex items-center gap-2">
                      {targets.some((t) => getTicketReleases(t).length === 0) ? (
                        <button
                          type="button"
                          className="text-[11px] font-medium text-primary hover:underline"
                          onClick={tickBlank}
                        >
                          Only without waves
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-[11px] font-medium text-primary hover:underline"
                        onClick={tickAll}
                      >
                        {pickedIds.length === targets.length ? "Clear all" : "Tick all"}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-surface-subtle p-1">
                    {targets.map((t) => {
                      const rel = getTicketReleases(t);
                      return (
                        <label
                          key={t.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:bg-surface-active"
                        >
                          <Checkbox
                            checked={pickedSet.has(String(t.id))}
                            onCheckedChange={() => toggle(t.id)}
                            aria-label={`Apply to ${t.name || "ticket"}`}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {t.name || "Untitled ticket"}
                          </span>
                          <span className="shrink-0 text-[11px] text-text-secondary">
                            {rel.length
                              ? `${rel.length} wave${rel.length > 1 ? "s" : ""} now`
                              : "no waves yet"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button
                  size="sm"
                  disabled={!source || !pickedIds.length}
                  onClick={() => {
                    onBulkCopy(effectiveSourceId, pickedIds);
                    setPicked(new Set());
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy to{" "}
                  {pickedIds.length
                    ? `${pickedIds.length} ticket${pickedIds.length > 1 ? "s" : ""}`
                    : "…"}
                </Button>
                <ConfirmButton
                  size="sm"
                  variant="ghost"
                  onConfirm={() => {
                    onBulkRemove(pickedIds);
                    setPicked(new Set());
                  }}
                  className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove waves from{" "}
                  {pickedIds.length ? pickedIds.length : "…"}
                </ConfirmButton>
                {withoutWaves ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onSplitAll}
                    className="ml-auto text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    <Zap className="h-3.5 w-3.5" /> Split all without waves into 2
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// One ticket: glanceable summary when closed, wave editor when open. Edits go
// to a draft held by the section — collapsing never loses work, and the badge
// on the closed card says so.
function TicketWaveCard({
  ticket,
  sold,
  soldOutAtMap,
  open,
  draft,
  others,
  onToggle,
  setDraft,
  discardDraft,
  onSave,
  onQuickStart,
  onRemove,
  onCopy,
  defaultDelay,
  defaultQty,
}) {
  const saved = getTicketReleases(ticket);
  const hasWaves = saved.length > 0;
  const waves = draft ?? saved;
  const dirty =
    hasWaves &&
    draft != null &&
    JSON.stringify(draft.map((r) => normalizeRelease(r))) !== JSON.stringify(saved);
  const err = validateReleases(waves);
  const state = useMemo(
    () => resolveTicketReleases(ticket, { sold, soldOutAtMap, now: new Date() }),
    [ticket, sold, soldOutAtMap],
  );
  const totalQty = state.hasReleases ? state.totalQty : Number(ticket.qty) || 0;
  const pct = totalQty > 0 ? Math.min(100, Math.round((sold / totalQty) * 100)) : 0;
  const setupMode = open && !hasWaves && draft == null;
  const draftTotal = waves.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const submit = () => {
    if (err) {
      toast.error(err);
      return;
    }
    onSave(ticket.id, waves.map((r, i) => normalizeRelease(r, i)));
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-card transition-colors",
        open ? "border-border-strong" : "border-border",
      )}
    >
      {/* Summary — always visible */}
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {ticket.name || "Untitled ticket"}
            </p>
            {dirty ? <Badge variant="warning">Unsaved edits</Badge> : null}
            {state.hasReleases ? (
              <Badge variant="neutral" className="shrink-0">
                <Layers className="h-3 w-3" /> {state.releases.length} wave
                {state.releases.length > 1 ? "s" : ""}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 text-text-secondary">
                One pool · {totalQty > 0 ? `${totalQty} tickets` : "Unlimited"}
              </Badge>
            )}
          </div>

          {state.hasReleases ? <MiniTimeline state={state} /> : null}

          <p className="text-xs text-text-secondary">{summaryFor(ticket, state)}</p>

          {totalQty > 0 ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-surface-active">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-text-secondary">
                {sold}/{totalQty} sold
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {others && state.hasReleases ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onCopy}
              title="Copy these waves to other tickets"
              aria-label="Copy these waves to other tickets"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={state.hasReleases ? "ghost" : "default"}
            onClick={onToggle}
            className={state.hasReleases ? "text-muted-foreground hover:bg-surface-active hover:text-foreground" : ""}
          >
            {open ? "Close" : state.hasReleases ? "Edit waves" : "Split into waves"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
          </Button>
        </div>
      </div>

      {open ? (
        setupMode ? (
          <SplitSetup
            ticket={ticket}
            defaultDelay={defaultDelay}
            defaultQty={defaultQty}
            onStart={onQuickStart}
            onCancel={onToggle}
          />
        ) : (
          <div className="space-y-3 border-t border-border p-3 sm:p-4">
            <WaveChainEditor
              releases={waves}
              setReleases={(next) => setDraft(ticket.id, next)}
              sold={sold}
              soldOutAtMap={soldOutAtMap}
            />

            {waves.length ? (
              <p className="flex items-start gap-1.5 text-[11px] text-text-secondary">
                <Eye className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>
                  {dirty ? "Buyers will see:" : "Buyers see:"}{" "}
                  <span className="text-foreground/80">
                    {releaseSummaryForTicket(
                      { qty: draftTotal, releases: waves },
                      { sold, soldOutAtMap, now: new Date() },
                    )}
                  </span>
                </span>
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button size="sm" onClick={submit} disabled={!dirty && !err}>
                <CheckCircle2 className="h-4 w-4" /> Save waves
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => discardDraft(ticket.id)}
                disabled={!dirty}
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Discard
              </Button>
              {err ? (
                <span className="text-[11px] font-medium text-red-500">{err}</span>
              ) : dirty ? (
                <span className="text-[11px] text-amber-500">Unsaved changes</span>
              ) : null}
              <div className="ml-auto flex flex-wrap items-center gap-1">
                {others && waves.length ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCopy}
                    className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy to other tickets
                  </Button>
                ) : null}
                {hasWaves ? (
                  <ConfirmButton
                    size="sm"
                    onConfirm={() => onRemove(ticket.id)}
                    className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove waves
                  </ConfirmButton>
                ) : null}
              </div>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

// Event-editor section: batched releases for THIS event's tickets. Each ticket
// splits into waves that sell in order; wave setup, copy-to-others and removal
// all happen on the ticket's own card. Storage is the same `tickets[].releases`
// the rest of the app reads.
export function EventReleasesSection({ event, headerItem }) {
  const { projectId } = useProject();
  const [tickets, setTickets, saveTickets] = useEventConfig(event, "tickets", []);
  const [proj, setProj] = useState(null);
  const [projLoaded, setProjLoaded] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({}); // ticketId -> unsaved waves
  const [copyFrom, setCopyFrom] = useState(null);

  useEffect(() => {
    let alive = true;
    getSetting(projectId, "release").then((res) => {
      if (!alive) return;
      setProj({ ...defaultReleaseConfig(), ...(res?.config || {}) });
      setProjLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const list = useMemo(() => (Array.isArray(tickets) ? tickets : []), [tickets]);
  const soldMap = useMemo(
    () => (event?.ticketSold && typeof event.ticketSold === "object" ? event.ticketSold : {}),
    [event],
  );
  const soldOutAtMap = useMemo(
    () =>
      event?.releaseSoldOutAt && typeof event.releaseSoldOutAt === "object" ? event.releaseSoldOutAt : {},
    [event],
  );

  const wavesOf = (t) => (t && t.id in drafts ? drafts[t.id] : getTicketReleases(t));

  // Ticket cards page with the shared list pagination, so events with many
  // tickets stay scannable. Reset to page 1 when tickets are added/removed.
  const pager = usePagination(list, {
    pageSize: 10,
    resetKey: `${list.length}`,
  });
  const handlePageChange = (p) => {
    setOpenId(null);
    pager.onPageChange(p);
  };
  const handlePageSizeChange = (s) => {
    setOpenId(null);
    pager.onPageSizeChange(s);
  };

  const batchedCount = list.filter((t) => getTicketReleases(t).length > 0).length;
  const stats = useMemo(() => {
    let held = 0;
    let sold = 0;
    list.forEach((t) => {
      const s = Number(soldMap[t.id]) || 0;
      sold += s;
      const st = resolveTicketReleases(t, { sold: s, soldOutAtMap, now: new Date() });
      if (st.hasReleases && !st.unlimitedUnlocked) {
        held += Math.max(0, (st.totalQty || 0) - (st.unlockedQty || 0));
      }
    });
    return { held, sold };
  }, [list, soldMap, soldOutAtMap]);

  const writeTickets = (next, msg) => {
    setTickets(next);
    saveTickets(next, msg ? { successMsg: msg } : undefined);
  };

  const setDraft = (id, waves) => setDrafts((d) => ({ ...d, [id]: waves }));
  const clearDraft = (id) =>
    setDrafts((d) => {
      if (!(id in d)) return d;
      const next = { ...d };
      delete next[id];
      return next;
    });

  // Opening a card seeds its draft from the saved waves, so editing always
  // happens on the draft and the saved state stays intact until "Save".
  const toggleCard = (t) => {
    if (openId === t.id) {
      setOpenId(null);
      return;
    }
    if (getTicketReleases(t).length && !(t.id in drafts)) setDraft(t.id, getTicketReleases(t));
    setOpenId(t.id);
  };

  const saveCard = (id, waves) => {
    const total = waves.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    writeTickets(
      list.map((t) => (t.id === id ? { ...t, qty: total, releases: waves } : t)),
      "Waves saved.",
    );
    clearDraft(id);
    setOpenId(null);
  };

  const quickStart = (id, waves, effectiveTotal) => {
    writeTickets(
      list.map((t) => (t.id === id ? { ...t, qty: effectiveTotal, releases: waves } : t)),
      "Waves started — the ticket now sells in waves.",
    );
    setOpenId(null);
  };

  const removeWaves = (id) => {
    writeTickets(
      list.map((t) => (t.id === id ? { ...t, releases: [] } : t)),
      "Waves removed — the ticket sells as one pool again.",
    );
    clearDraft(id);
    setOpenId(null);
  };

  // Copy the source ticket's waves (as shown, draft included) onto the picked
  // targets. Release ids are re-minted per copy because sell-out stamps are
  // keyed by release id at the event level.
  const applyCopy = (sourceId, targetIds) => {
    const src = list.find((t) => String(t.id) === String(sourceId));
    if (!src) return;
    const srcWaves = getTicketReleases({ releases: wavesOf(src) });
    if (!srcWaves.length) {
      toast.error("That ticket has no waves to copy.");
      return;
    }
    const map = new Map(srcWaves.map((r) => [String(r.id), newReleaseId()]));
    const waves = srcWaves.map((r, i) => {
      const n = normalizeRelease(r, i);
      n.id = map.get(String(r.id)) || n.id;
      if (n.afterReleaseId && map.has(String(n.afterReleaseId))) n.afterReleaseId = map.get(String(n.afterReleaseId));
      return n;
    });
    const total = waves.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const ids = new Set(targetIds.map(String));
    writeTickets(
      list.map((t) =>
        ids.has(String(t.id)) ? { ...t, qty: total, releases: waves.map((r) => ({ ...r })) } : t,
      ),
      `Waves copied to ${targetIds.length} ticket${targetIds.length > 1 ? "s" : ""}.`,
    );
    // Targets with open drafts would show stale waves — drop them so each card
    // re-seeds from what was just saved.
    targetIds.forEach((id) => clearDraft(id));
    setCopyFrom(null);
  };

  const bulkRemove = (targetIds) => {
    if (!targetIds?.length) return;
    const ids = new Set(targetIds.map(String));
    writeTickets(
      list.map((t) => (ids.has(String(t.id)) ? { ...t, releases: [] } : t)),
      `Waves removed from ${targetIds.length} ticket${targetIds.length > 1 ? "s" : ""} — they sell as one pool again.`,
    );
    targetIds.forEach((id) => clearDraft(id));
  };

  // Starter for the bulk accordion: every ticket without waves sells in 2
  // waves. Tickets with 0/1 stock are left alone (nothing sane to split).
  const splitAllStarter = () => {
    const qtyFallback = Math.max(1, Number(proj?.defaultQty) || 100);
    const delayFallback = Math.max(0, Number(proj?.defaultDelayDays) || 0);
    let touched = 0;
    const next = list.map((t) => {
      if (getTicketReleases(t).length) return t;
      const total = Number(t.qty) || 0;
      if (total > 0 && total <= 1) return t;
      const first = total > 0 ? Math.max(1, Math.ceil(total / 2)) : qtyFallback;
      const second = total > 0 ? Math.max(1, total - first) : qtyFallback;
      if (second <= 0) return t;
      const r1 = { ...defaultRelease(0, first), id: newReleaseId(), name: "Wave 1", startMode: "now" };
      const r2 = {
        ...defaultRelease(1, second),
        id: newReleaseId(),
        name: "Wave 2",
        startMode: "after_stockout",
        afterReleaseId: r1.id,
        delayDays: delayFallback,
        released: true,
      };
      touched += 1;
      return { ...t, qty: total > 0 ? total : first + second, releases: [r1, r2] };
    });
    if (!touched) {
      toast.error("Every ticket already has waves — or has too few tickets to split.");
      return;
    }
    writeTickets(next, `${touched} ticket${touched > 1 ? "s" : ""} now sell${touched > 1 ? "" : "s"} in 2 waves.`);
  };

  const copySource = list.find((t) => String(t.id) === String(copyFrom)) || null;

  const statPills = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card px-2.5 py-1 text-[11px]">
        <Layers className="h-3 w-3 text-primary" />
        <strong className="tabular-nums">{batchedCount}/{list.length}</strong>
        <span className="text-text-secondary">tickets in waves</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card px-2.5 py-1 text-[11px]">
        <Hourglass className="h-3 w-3 text-amber-500" />
        <strong className="tabular-nums">{stats.held}</strong>
        <span className="text-text-secondary">waiting for later waves</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card px-2.5 py-1 text-[11px]">
        <ShoppingCart className="h-3 w-3 text-emerald-500" />
        <strong className="tabular-nums">{stats.sold}</strong>
        <span className="text-text-secondary">sold so far</span>
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Batched Releases"}
        description={
          headerItem?.desc ||
          "Split a ticket's stock into waves — wave 1 sells first, later waves open on a date, after a sell-out, or when you open them. Click a ticket below to set it up."
        }
        action={list.length ? statPills : undefined}
      />

      {projLoaded && !proj?.enabled ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Batched releases are switched off for this project —{" "}
            <strong className="font-semibold">Tickets → Batched Releases</strong> turns them on. Waves
            set here still save to this event.
          </span>
        </div>
      ) : null}

      {!list.length ? (
        <EmptyState
          icon={Layers}
          title="No tickets yet"
          description="Waves split a ticket's stock — create tickets under Tickets first, then come back here."
        />
      ) : (
        <>
          {list.length > 1 ? (
            <BulkWavesCard
              list={list}
              wavesOf={wavesOf}
              drafts={drafts}
              onBulkCopy={applyCopy}
              onBulkRemove={bulkRemove}
              onSplitAll={splitAllStarter}
            />
          ) : null}

          <div className="space-y-3">
            {pager.pageItems.map((t) => (
              <TicketWaveCard
                key={t.id}
                ticket={t}
                sold={Number(soldMap[t.id]) || 0}
                soldOutAtMap={soldOutAtMap}
                open={openId === t.id}
                draft={drafts[t.id]}
                others={list.length > 1}
                onToggle={() => toggleCard(t)}
                setDraft={setDraft}
                discardDraft={clearDraft}
                onSave={saveCard}
                onQuickStart={quickStart}
                onRemove={removeWaves}
                onCopy={() => setCopyFrom(t.id)}
                defaultDelay={proj?.defaultDelayDays ?? 0}
                defaultQty={proj?.defaultQty ?? 100}
              />
            ))}
          </div>

          <ListPagination
            page={pager.page}
            pageSize={pager.pageSize}
            total={pager.total}
            totalPages={pager.totalPages}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            itemLabel="tickets"
          />
        </>
      )}

      {copySource ? (
        <CopyWavesDialog
          source={copySource}
          waves={getTicketReleases({ releases: wavesOf(copySource) })}
          targets={list.filter((t) => t.id !== copySource.id)}
          sourceDirty={
            copySource.id in drafts &&
            JSON.stringify(drafts[copySource.id].map((r) => normalizeRelease(r))) !==
              JSON.stringify(getTicketReleases(copySource))
          }
          onApply={(ids) => applyCopy(copySource.id, ids)}
          onClose={() => setCopyFrom(null)}
        />
      ) : null}
    </div>
  );
}

export default EventReleasesSection;
