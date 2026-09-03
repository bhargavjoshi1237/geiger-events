"use client";

import React, { useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Flame,
  Hand,
  Pause,
  Play,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { cn } from "@/lib/utils";
import {
  defaultRelease,
  formatReleaseDate,
  normalizeRelease,
  resolveTicketReleases,
} from "@/lib/events/ticket_releases";

// ————— Shared presentation helpers ————————————————————————————————
// The Batched Releases section (event_releases.jsx) reuses these so the
// collapsed cards and the editor speak exactly the same language.

// "When does this wave open?" — the gate in front of the wave.
export const GATE_META = {
  now: { icon: Zap, title: "On sale now" },
  date: { icon: CalendarClock, title: "On a date" },
  after_stockout: { icon: Flame, title: "After sell-out" },
  manual: { icon: Hand, title: "I'll open it" },
};

// One tone map for every wave state, used by badges, dots and timeline nodes.
export const STATUS_TONE = {
  live: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  scheduled: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  waiting_stockout: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  waiting_delay: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  manual_hold: "border-border bg-surface-active text-muted-foreground",
  paused: "border-border bg-surface-active text-muted-foreground",
  ended: "border-border bg-surface-active text-muted-foreground",
  soldout: "border-rose-500/40 bg-rose-500/10 text-rose-500",
};

function toneFor(status) {
  return STATUS_TONE[status] || STATUS_TONE.manual_hold;
}

// Solid status dot beside the neutral wave number. Numbers stay readable in
// both themes; the dot carries the status (emerald = on sale, rose = sold
// out, amber = waiting, sky = scheduled, grey = held/paused/closed).
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

function triggerOf(list, triggerId) {
  if (!triggerId) return null;
  return list.find((r) => String(r.id) === String(triggerId)) || null;
}

// Friendly status badge for one wave. `list` is the ticket's normalized waves
// (used to name the wave a waiting one depends on).
export function statusBadge(per, list) {
  if (per.soldOut) return { label: "Sold out", className: STATUS_TONE.soldout };
  switch (per.status) {
    case "live":
      return { label: "On sale", className: STATUS_TONE.live };
    case "scheduled":
      return {
        label: per.unlocksAt ? `Opens ${formatReleaseDate(per.unlocksAt)}` : "Scheduled",
        className: STATUS_TONE.scheduled,
      };
    case "waiting_stockout": {
      const t = triggerOf(list, per.triggerId);
      return {
        label: t ? `Waits for “${t.name}”` : "Waits for sell-out",
        className: STATUS_TONE.waiting_stockout,
      };
    }
    case "waiting_delay":
      return {
        label: per.unlocksAt ? `Opens ${formatReleaseDate(per.unlocksAt)}` : "Waiting to open",
        className: STATUS_TONE.waiting_delay,
      };
    case "manual_hold":
      return { label: "Not opened yet", className: STATUS_TONE.manual_hold };
    case "paused":
      return { label: "Paused", className: STATUS_TONE.paused };
    case "ended":
      return { label: "Closed", className: STATUS_TONE.ended };
    default:
      return { label: per.statusLabel || "—", className: toneFor(per.status) };
  }
}

// Short "when does it open" phrase used in collapsed summaries, e.g.
// "Wave 2 opens when Wave 1 sells out".
export function gateShort(r, idx, list) {
  if (r.startMode === "date")
    return (r.startAt || "").trim() ? `opens ${formatReleaseDate(r.startAt)}` : "opens on a date";
  if (r.startMode === "after_stockout") {
    const t = triggerOf(list, r.afterReleaseId) || (idx > 0 ? list[idx - 1] : null);
    const wait = Number(r.delayDays) > 0 ? ` (${r.delayDays} day${Number(r.delayDays) === 1 ? "" : "s"} later)` : "";
    return `opens when ${t ? `“${t.name}”` : "the previous wave"} sells out${wait}`;
  }
  if (r.startMode === "manual") return r.released ? "is open" : "opens when you open it";
  return idx === 0 ? "on sale now" : "is open";
}

// Validation for a whole wave list — used by the editor and the section so
// both block saving for the same reasons. Returns an error string or null.
export function validateReleases(releases) {
  const list = (Array.isArray(releases) ? releases : []).map((r, i) => normalizeRelease(r, i));
  if (!list.length) return "Split the ticket into at least one wave — or use Remove waves below.";
  for (const r of list) {
    if (!(Number(r.qty) > 0)) return "Every wave needs at least 1 ticket.";
    if (r.startMode === "date" && !(r.startAt || "").trim())
      return "Pick an opening date for every dated wave.";
  }
  return null;
}

function waveProblem(r) {
  if (!(Number(r.qty) > 0)) return "Give this wave at least 1 ticket.";
  if (r.startMode === "date" && !(r.startAt || "").trim())
    return "Pick the date this wave opens.";
  return null;
}

// ————— Visuals ——————————————————————————————————————————————————

// Proportional bar showing how the ticket's stock is split across waves.
function SplitBar({ list }) {
  const total = list.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  if (total <= 0) return null;
  const fades = ["bg-primary", "bg-primary/70", "bg-primary/50", "bg-primary/35", "bg-primary/25"];
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-surface-active"
      role="img"
      aria-label={`Stock split across ${list.length} waves`}
    >
      {list.map((r, i) => (
        <span
          key={r.id}
          title={`${r.name || `Wave ${i + 1}`} — ${Number(r.qty) || 0} tickets`}
          style={{ width: `${(Number(r.qty) / total) * 100}%` }}
          className={cn("h-full border-l border-background/50 first:border-l-0", fades[Math.min(i, fades.length - 1)])}
        />
      ))}
    </div>
  );
}

// The gate in front of a wave: when can buyers reach it? Rendered as a row of
// pills — one pill per option, the active one highlighted. `now` appears for
// later waves only when it is already the stored mode (e.g. after "Open now").
function GatePicker({ r, idx, onPick }) {
  const base = idx === 0 ? ["now", "date", "manual"] : ["after_stockout", "date", "manual"];
  const modes = idx > 0 && r.startMode === "now" ? ["now", ...base] : base;
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="radiogroup"
      aria-label={`When wave ${idx + 1} opens`}
    >
      {modes.map((m) => {
        const meta = GATE_META[m];
        const Icon = meta.icon;
        const active = r.startMode === m;
        const label = m === "after_stockout" ? `After wave ${idx} sells out` : meta.title;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            title={
              m === "after_stockout"
                ? `Opens automatically when wave ${idx} sells out`
                : m === "manual"
                  ? "Stays hidden until you open it"
                  : m === "date"
                    ? "Opens automatically on the date you pick"
                    : "No gate — buyers reach it with the wave above"
            }
            onClick={() => onPick(m)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border bg-surface-card text-text-secondary hover:border-border-strong hover:text-foreground",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-muted-foreground")} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function waitingNote(per, r, list) {
  if (per.status === "paused") return "Paused — buyers can't see this wave.";
  if (per.status === "manual_hold") return "Hidden until you open it.";
  if (per.status === "scheduled") return `Opens automatically ${formatReleaseDate(per.unlocksAt)}.`;
  if (per.status === "waiting_delay")
    return `Opens ${formatReleaseDate(per.unlocksAt)} — ${Number(r.delayDays) || 0} day${
      Number(r.delayDays) === 1 ? "" : "s"
    } after the sell-out.`;
  if (per.status === "waiting_stockout") {
    const t = triggerOf(list, per.triggerId);
    return `Waiting for ${t ? `“${t.name}”` : "the previous wave"} to sell out.`;
  }
  return null;
}

// One wave on the timeline: numbered node on a rail, card on the right.
function WaveNode({ r, idx, list, per, total, patchRelease, removeRelease, moveRelease }) {
  const problem = waveProblem(r);
  const badge = per ? statusBadge(per, list) : null;
  const share = total > 0 ? Math.round((Number(r.qty) / total) * 100) : 0;
  const soldInWave = per?.sold ?? 0;
  const waveCap = Number(r.qty) || 0;
  const pct = waveCap > 0 ? Math.min(100, Math.round((soldInWave / waveCap) * 100)) : 0;
  const note = per && !per.unlocked && !per.soldOut ? waitingNote(per, r, list) : null;

  const setGate = (m) => {
    const prevId = idx > 0 ? list[idx - 1]?.id || "" : "";
    if (m === "after_stockout")
      patchRelease(r.id, { startMode: "after_stockout", afterReleaseId: prevId, paused: false });
    else if (m === "date") patchRelease(r.id, { startMode: "date", paused: false, released: true });
    else if (m === "manual") patchRelease(r.id, { startMode: "manual", paused: false, released: false });
    else patchRelease(r.id, { startMode: "now", paused: false, released: true });
  };

  return (
    <div className="flex gap-3">
      {/* Timeline rail — neutral number, status carried by the dot so the
      number stays readable in both themes. */}
      <div className="flex w-7 shrink-0 flex-col items-center" aria-hidden="true">
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-card text-[12px] font-bold tabular-nums text-foreground">
          {idx + 1}
          {per ? (
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-subtle",
                dotClassFor(per.status),
              )}
            />
          ) : null}
        </span>
        {idx < list.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
      </div>

      <div
        className={cn(
          "min-w-0 flex-1 space-y-3 rounded-xl border bg-surface-subtle p-3",
          problem ? "border-red-500/50" : "border-border",
          r.paused ? "opacity-90" : "",
        )}
      >
        {/* Name + live status */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={r.name}
            onChange={(e) => patchRelease(r.id, { name: e.target.value })}
            placeholder={`Wave ${idx + 1} — e.g. Early birds`}
            aria-label={`Wave ${idx + 1} name`}
            className="h-8 min-w-[9rem] flex-1 bg-surface-card"
          />
          {badge ? (
            <Badge variant="outline" className={cn("max-w-[14rem] shrink-0 border", badge.className)}>
              <span className="truncate">{badge.label}</span>
            </Badge>
          ) : null}
        </div>

        {/* Size + progress */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label={`Tickets in wave ${idx + 1}`}
              className={cn("h-8 w-20 bg-surface-card tabular-nums", !(Number(r.qty) > 0) ? "border-red-500" : "")}
              value={r.qty}
              onChange={(e) => patchRelease(r.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
            />
            <span className="text-xs text-text-secondary">
              tickets{total > 0 && waveCap > 0 ? ` · ${share}%` : ""}
            </span>
          </div>
          {waveCap > 0 && (soldInWave > 0 || per?.soldOut) ? (
            <div className="flex min-w-[8rem] flex-1 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-active">
                <div
                  className={cn("h-full rounded-full", per?.soldOut ? "bg-rose-500" : "bg-emerald-500")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-text-secondary">
                {soldInWave}/{waveCap}
              </span>
            </div>
          ) : null}
        </div>

        {/* The gate — when this wave opens */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
            {idx === 0 ? "On sale" : "Opens"}
          </p>
          <GatePicker r={r} idx={idx} onPick={setGate} />

          {r.startMode === "date" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Opens on">
                <Input
                  type="datetime-local"
                  value={r.startAt || ""}
                  onChange={(e) => patchRelease(r.id, { startAt: e.target.value })}
                  className={cn("h-8 bg-surface-card", !(r.startAt || "").trim() ? "border-red-500" : "")}
                />
              </Field>
              <Field label="Closes (optional)" hint="Leave blank to stay on sale.">
                <Input
                  type="datetime-local"
                  value={r.endAt || ""}
                  onChange={(e) => patchRelease(r.id, { endAt: e.target.value })}
                  className="h-8 bg-surface-card"
                />
              </Field>
            </div>
          ) : null}

          {r.startMode === "after_stockout" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-text-secondary">then wait</span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label="Days to wait after the sell-out"
                className="h-8 w-16 bg-surface-card tabular-nums"
                value={r.delayDays ?? 0}
                onChange={(e) => patchRelease(r.id, { delayDays: Math.max(0, Number(e.target.value) || 0) })}
              />
              <span className="text-[11px] text-text-secondary">
                {Number(r.delayDays) > 0 ? "days" : "days — 0 opens it right away"}
              </span>
            </div>
          ) : null}

          {r.startMode === "manual" ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {r.released ? "Open — buyers can buy this wave" : "Held — buyers can't see it"}
                </p>
                <p className="text-[11px] text-text-secondary">
                  {r.released ? "Switch off to hide it again." : "Switch on when you're ready."}
                </p>
              </div>
              <Switch
                checked={!!r.released}
                onCheckedChange={(v) => patchRelease(r.id, { released: v })}
                aria-label={`${r.released ? "Hide" : "Open"} ${r.name || `wave ${idx + 1}`}`}
              />
            </div>
          ) : null}
        </div>

        {note ? <p className="text-[11px] text-text-secondary">{note}</p> : null}
        {problem ? <p className="text-[11px] font-medium text-red-500">{problem}</p> : null}

        {/* Wave actions */}
        <div className="flex items-center gap-1 border-t border-border pt-2">
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={idx === 0}
            onClick={() => moveRelease(r.id, -1)}
            aria-label={`Sell wave ${idx + 1} earlier`}
            title="Sell this wave earlier in the order"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={idx === list.length - 1}
            onClick={() => moveRelease(r.id, 1)}
            aria-label={`Sell wave ${idx + 1} later`}
            title="Sell this wave later in the order"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          {per && !per.unlocked && !per.soldOut ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => patchRelease(r.id, { startMode: "now", paused: false, released: true })}
              className="h-6 px-2 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
              title="Open this wave to buyers right now"
            >
              Open now
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => patchRelease(r.id, { paused: !r.paused })}
            className="h-6 px-2 text-muted-foreground hover:bg-surface-active hover:text-foreground"
            title={r.paused ? "Start selling this wave again" : "Temporarily hide this wave from buyers"}
          >
            {r.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {r.paused ? "Resume" : "Pause"}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Delete wave ${idx + 1}`}
            title="Remove this wave — applies when you save"
            onClick={() => removeRelease(r.id)}
            className="ml-auto text-text-secondary hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ————— The editor ————————————————————————————————————————————————
// One ticket's waves as a vertical chain: wave 1 sells first, each later wave
// opens through the gate in front of it. Editing works on a draft — nothing
// here is saved until the caller commits.

export function WaveChainEditor({ releases, setReleases, sold, soldOutAtMap }) {
  const list = useMemo(() => {
    const raw = (Array.isArray(releases) ? releases : []).map((r, i) => normalizeRelease(r, i));
    // Wave 1 has no earlier wave to wait for — an after_stockout there behaves
    // exactly like "now", so present it as "now".
    return raw.map((r, i) => (i === 0 && r.startMode === "after_stockout" ? { ...r, startMode: "now" } : r));
  }, [releases]);

  const state = useMemo(
    () =>
      resolveTicketReleases(
        { qty: 0, releases: list },
        { sold, soldOutAtMap, now: new Date() },
      ),
    [list, sold, soldOutAtMap],
  );

  const total = list.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const openQty = state.activeReleases.reduce((s, p) => s + (Number(p.release.qty) || 0), 0);

  const patchRelease = (id, patch) =>
    setReleases(list.map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r)));

  // Structural changes re-chain sell-out gates so every wave waits on the one
  // directly above it — order stays truthful after deletes and moves.
  const rechain = (next) =>
    next.map((r, i) => {
      if (i === 0) return { ...r, afterReleaseId: "" };
      if (r.startMode === "after_stockout") return { ...r, afterReleaseId: next[i - 1]?.id || "" };
      return r;
    });

  const removeRelease = (id) => setReleases(rechain(list.filter((r) => String(r.id) !== String(id))));

  const moveRelease = (id, dir) => {
    const i = list.findIndex((r) => String(r.id) === String(id));
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setReleases(rechain(next));
  };

  const addWave = () => {
    const prev = list[list.length - 1];
    setReleases([
      ...list,
      {
        ...defaultRelease(list.length, 50),
        name: `Wave ${list.length + 1}`,
        startMode: "after_stockout",
        afterReleaseId: prev?.id || "",
        delayDays: 0,
        released: true,
        paused: false,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      {/* Split overview */}
      <div className="space-y-2">
        <SplitBar list={list} />
        <p className="text-xs tabular-nums text-text-secondary">
          <strong className="font-semibold text-foreground">{total}</strong> tickets across{" "}
          {list.length} wave{list.length > 1 ? "s" : ""}
          {openQty > 0 ? ` · ${openQty} open now` : ""}
          {sold ? ` · ${sold} sold` : ""}
        </p>
      </div>

      {/* The chain */}
      <div className="space-y-1">
        {list.map((r, idx) => (
          <WaveNode
            key={r.id}
            r={r}
            idx={idx}
            list={list}
            per={state.perRelease[idx]}
            total={total}
            patchRelease={patchRelease}
            removeRelease={removeRelease}
            moveRelease={moveRelease}
          />
        ))}
      </div>

      <div className="pl-10">
        <button
          type="button"
          onClick={addWave}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Add another wave
        </button>
      </div>
    </div>
  );
}

export default WaveChainEditor;
