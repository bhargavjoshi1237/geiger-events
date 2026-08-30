"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Package,
  PackageCheck,
  Search,
  ShieldAlert,
  Undo2,
  UserRound,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { IconInput } from "@/components/internal/shared/icon_input";
import { cn } from "@/lib/utils";
import { RouteShell } from "@/components/checkin_routes/route_shell";
import { QrScanner } from "@/components/checkin_routes/qr_scanner";
import {
  issueStats,
  listEntitlements,
  listOpenAllocations,
  lookupSubjects,
  redeemEntitlement,
  undoRedemption,
} from "@/lib/supabase/issuing";
import { blockLabel, redeemLabel } from "@/lib/inventory/entitlements";

const qty = (n) => {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

const label = (v) => (v?.variantLabel ? `${v.name} — ${v.variantLabel}` : v?.name || "Item");

const timeAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

function Thumb({ url, className }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={cn("h-12 w-12 shrink-0 rounded-xl border border-border object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-card text-text-tertiary",
        className,
      )}
    >
      <Package className="h-5 w-5" />
    </div>
  );
}

function Notice({ tone = "warning", children }) {
  return (
    <p
      className={cn(
        "rounded-lg border px-4 py-2.5 text-sm",
        tone === "danger"
          ? "border-red-500/20 bg-red-500/10 text-red-200"
          : tone === "muted"
            ? "border-border bg-surface-subtle text-text-secondary"
            : "border-amber-500/20 bg-amber-500/10 text-amber-200",
      )}
    >
      {children}
    </p>
  );
}

function FindView({ onPick, onWalkup, canWalkup, lookup, recent, onUndo, canReturn }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [paused, setPaused] = useState(false);

  const run = async (text) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setBusy(true);
    setMsg("");
    const results = await lookup(q);
    setBusy(false);
    setRows(results || []);
    if (results?.length === 1) onPick(results[0]);
    else if (!results?.length) setMsg("No match — try a name or email.");
  };

  const onScan = (text) => {
    setPaused(true);
    setQuery(text);
    run(text).finally(() => setTimeout(() => setPaused(false), 1500));
  };

  return (
    <div className="space-y-4">
      <QrScanner onDecode={onScan} paused={paused} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="flex gap-2"
      >
        <IconInput
          icon={Search}
          wrapperClassName="flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, email, ticket or order code"
          className="h-11 bg-surface-card"
        />
        <Button
          type="submit"
          disabled={busy}
          className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
        </Button>
      </form>

      {msg ? <Notice>{msg}</Notice> : null}

      {rows.map((r) => (
        <button
          key={`${r.subjectKind}:${r.subjectId}`}
          type="button"
          onClick={() => onPick(r)}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-subtle p-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{r.name || "Guest"}</p>
            <p className="truncate text-xs text-text-secondary">
              {r.email || "No email"} · <span className="font-mono">{r.ticketCode}</span>
              {r.ticketName ? ` · ${r.ticketName}` : ""}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
        </button>
      ))}

      {canWalkup ? (
        <Button
          variant="outline"
          onClick={onWalkup}
          className="h-11 w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Boxes className="h-4 w-4" /> Walk-up issue (no attendee)
        </Button>
      ) : null}

      {recent.length ? (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Handed out on this device
          </p>
          {recent.map((r) => (
            <div
              key={r.redemptionId}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3.5 py-2.5"
            >
              <PackageCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.itemLabel}</p>
                <p className="truncate text-xs text-text-secondary">
                  {r.who} · {timeAgo(r.at)}
                </p>
              </div>
              {canReturn && !r.undone ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUndo(r)}
                  className="shrink-0 text-text-secondary hover:text-foreground"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </Button>
              ) : r.undone ? (
                <span className="shrink-0 text-xs text-text-tertiary">Undone</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EntitlementsView({ subject, entitlements, loading, onIssue, onBack, canOverride }) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="rounded-xl border border-border bg-surface-subtle p-4">
        <p className="text-lg font-semibold text-foreground">{subject.name || "Guest"}</p>
        <p className="text-sm text-text-secondary">
          {subject.email || "No email"} · <span className="font-mono">{subject.ticketCode}</span>
        </p>
        {subject.ticketName ? (
          <p className="mt-1 text-sm text-text-secondary">{subject.ticketName}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking entitlements…
        </div>
      ) : !entitlements.length ? (
        <Notice tone="muted">Nothing to collect for this attendee.</Notice>
      ) : (
        entitlements.map((ent) => {
          const blocked = Boolean(ent.blockedReason);
          const canAct = !blocked || canOverride;
          return (
            <div
              key={ent.allocationId}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-3.5"
            >
              <Thumb url={ent.imageUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {ent.variantLabel ? `${ent.itemName} — ${ent.variantLabel}` : ent.itemName}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {qty(ent.redeemedQty)} of {qty(ent.entitledQty)} collected
                  {ent.periodLabel ? ` · ${ent.periodLabel}` : ""}
                </p>
                {blocked ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-300">
                    <Clock className="h-3 w-3" />
                    {blockLabel(ent.blockedReason)}
                    {ent.lastAt ? ` · ${timeAgo(ent.lastAt)}` : ""}
                  </p>
                ) : null}
              </div>
              <Button
                disabled={!canAct}
                onClick={() => onIssue(ent)}
                className={cn(
                  "h-10 shrink-0",
                  blocked
                    ? "bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {blocked ? "Override" : "Issue"}
              </Button>
            </div>
          );
        })
      )}
    </div>
  );
}

function ConfirmView({
  entitlement,
  subject,
  isOverride,
  onConfirm,
  onBack,
  busy,
  error,
}) {
  const variants = entitlement.variants || [];
  const firstInStock = variants.find((v) => Number(v.onHand || 0) > 0) || variants[0];
  const [variantId, setVariantId] = useState(firstInStock?.id || "");
  const [count, setCount] = useState(1);
  const [reason, setReason] = useState("");

  const max = Math.max(1, Math.floor(Number(entitlement.remaining || 1)) || 1);
  const chosen = variants.find((v) => v.id === variantId) || firstInStock;
  const outOfStock = Number(chosen?.onHand || 0) <= 0;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4">
        <Thumb url={chosen?.imageUrl || entitlement.imageUrl} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{entitlement.itemName}</p>
          <p className="truncate text-sm text-text-secondary">
            {subject ? subject.name || "Guest" : "Walk-up · no attendee"}
          </p>
        </div>
      </div>

      {variants.length > 1 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Pick the variant
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {variants.map((v) => {
              const none = Number(v.onHand || 0) <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    v.id === variantId
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-card hover:bg-surface-hover",
                  )}
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {v.variantLabel || v.name}
                  </p>
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      none ? "text-red-400" : "text-text-secondary",
                    )}
                  >
                    {none ? "Out of stock" : `${qty(v.onHand)} on hand`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {max > 1 ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <span className="text-sm text-text-secondary">Quantity</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              className="h-9 w-9 border-border bg-transparent p-0 text-lg text-muted-foreground"
              aria-label="Decrease quantity"
            >
              −
            </Button>
            <span className="w-8 text-center text-lg font-semibold tabular-nums text-foreground">
              {count}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCount((c) => Math.min(max, c + 1))}
              className="h-9 w-9 border-border bg-transparent p-0 text-lg text-muted-foreground"
              aria-label="Increase quantity"
            >
              +
            </Button>
          </div>
        </div>
      ) : null}

      {isOverride ? (
        <div className="space-y-2">
          <Notice tone="warning">
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              {blockLabel(entitlement.blockedReason)} — this will be logged as an override.
            </span>
          </Notice>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for the override"
            className="h-11 bg-surface-card"
          />
        </div>
      ) : null}

      {outOfStock ? <Notice tone="danger">This variant shows no stock on hand.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Button
        disabled={busy || !chosen || (isOverride && !reason.trim())}
        onClick={() => onConfirm({ itemId: chosen?.id, qty: count, reason: reason.trim() })}
        className="h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
        {busy ? "Issuing…" : `Hand over${count > 1 ? ` ${count}` : ""}`}
      </Button>
    </div>
  );
}

function DoneView({ result, onDone, onUndo, canReturn }) {
  useEffect(() => {
    const t = setTimeout(onDone, 8000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-semibold text-foreground">Handed over</p>
        <p className="text-text-secondary">
          {result.itemLabel} · {result.who}
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button
          onClick={onDone}
          className="h-12 bg-primary text-base text-primary-foreground hover:bg-primary/90"
        >
          Next attendee
        </Button>
        {canReturn ? (
          <Button
            variant="outline"
            onClick={onUndo}
            className="h-11 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Undo2 className="h-4 w-4" /> Undo this
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function WalkupView({ allocations, loading, onPick, onBack }) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <h2 className="text-lg font-semibold text-foreground">Walk-up issue</h2>
      <p className="text-sm text-text-secondary">
        Stock handed out with no attendee attached — logged against the allocation only.
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading allocations…
        </div>
      ) : !allocations.length ? (
        <Notice tone="muted">No open allocations for this event.</Notice>
      ) : (
        allocations.map((a) => (
          <button
            key={a.allocationId}
            type="button"
            onClick={() => onPick(a)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-subtle p-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
          >
            <Thumb url={a.imageUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {a.variantLabel ? `${a.itemName} — ${a.variantLabel}` : a.itemName}
              </p>
              <p className="truncate text-xs text-text-secondary">
                {qty(a.issuedQty)} of {qty(a.plannedQty)} issued
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
          </button>
        ))
      )}
    </div>
  );
}

export function IssueDesk({ eventId, code, role, exit, event }) {
  const [subject, setSubject] = useState(null);
  const [entitlements, setEntitlements] = useState([]);
  const [loadingEnts, setLoadingEnts] = useState(false);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loadingAllocs, setLoadingAllocs] = useState(false);

  const perms = role?.permissions || {};
  const canOverride = Boolean(perms.canOverride);
  const canReturn = Boolean(perms.canReturn);

  const refreshStats = useCallback(() => {
    issueStats(eventId, code).then((s) => s && setStats(s));
  }, [eventId, code]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const lookup = useCallback((q) => lookupSubjects(eventId, code, q), [eventId, code]);

  const pickSubject = async (row) => {
    setSubject(row);
    setView("subject");
    setLoadingEnts(true);
    const rows = await listEntitlements(eventId, code, row.subjectKind, row.subjectId);
    setEntitlements(rows || []);
    setLoadingEnts(false);
  };

  const openWalkup = async () => {
    setView("walkup");
    setLoadingAllocs(true);
    const rows = await listOpenAllocations(eventId, code);
    setAllocations(rows || []);
    setLoadingAllocs(false);
  };

  const reset = () => {
    setSubject(null);
    setEntitlements([]);
    setActive(null);
    setResult(null);
    setError("");
    setView("find");
    refreshStats();
  };

  const startIssue = (ent, { walkup = false } = {}) => {
    setActive({ ...ent, walkup });
    setError("");
    setView("confirm");
  };

  const confirm = async ({ itemId, qty: count, reason }) => {
    if (!active || !itemId) return;
    const isOverride = Boolean(active.blockedReason) || active.walkup;
    setBusy(true);
    setError("");
    const res = await redeemEntitlement({
      eventId,
      code,
      allocationId: active.allocationId,
      itemId,
      subjectKind: active.walkup ? "walkup" : subject?.subjectKind,
      subjectId: active.walkup ? null : subject?.subjectId,
      qty: count,
      override: isOverride,
      reason,
      staff: role?.name || null,
      method: active.walkup ? "walkup" : "scan",
    });
    setBusy(false);

    if (!res?.ok) {
      setError(res ? redeemLabel(res.reason) : "Couldn't reach the server — try again.");
      return;
    }

    const variant = (active.variants || []).find((v) => v.id === itemId);
    const entry = {
      redemptionId: res.redemptionId,
      itemLabel: variant ? label(variant) : active.itemName,
      who: active.walkup ? "Walk-up" : subject?.name || "Guest",
      at: new Date().toISOString(),
      undone: false,
    };
    setRecent((prev) => [entry, ...prev].slice(0, 8));
    setResult(entry);
    setView("done");
    refreshStats();
  };

  const undo = async (entry) => {
    const res = await undoRedemption(eventId, code, entry.redemptionId);
    if (!res?.ok) {
      setError(res ? redeemLabel(res.reason) : "Couldn't undo that.");
      return;
    }
    setRecent((prev) =>
      prev.map((r) => (r.redemptionId === entry.redemptionId ? { ...r, undone: true } : r)),
    );
    refreshStats();
    if (view === "done") reset();
  };

  const badge = useMemo(
    () =>
      stats ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium tabular-nums text-emerald-300">
          <PackageCheck className="h-3.5 w-3.5" />
          {qty(stats.issuedToday)} today
        </span>
      ) : null,
    [stats],
  );

  return (
    <RouteShell
      title={event?.name || "Item issuing"}
      subtitle={role?.name ? `Issuing · ${role.name}` : "Issuing"}
      badge={badge}
      onExit={exit}
    >
      {view === "find" ? (
        <FindView
          lookup={lookup}
          onPick={pickSubject}
          onWalkup={openWalkup}
          canWalkup={canOverride}
          recent={recent}
          onUndo={undo}
          canReturn={canReturn}
        />
      ) : null}

      {view === "subject" && subject ? (
        <EntitlementsView
          subject={subject}
          entitlements={entitlements}
          loading={loadingEnts}
          onIssue={(ent) => startIssue(ent)}
          onBack={reset}
          canOverride={canOverride}
        />
      ) : null}

      {view === "walkup" ? (
        <WalkupView
          allocations={allocations}
          loading={loadingAllocs}
          onPick={(a) => startIssue({ ...a, remaining: 1, blockedReason: "" }, { walkup: true })}
          onBack={reset}
        />
      ) : null}

      {view === "confirm" && active ? (
        <ConfirmView
          entitlement={active}
          subject={active.walkup ? null : subject}
          isOverride={Boolean(active.blockedReason)}
          onConfirm={confirm}
          onBack={() => setView(active.walkup ? "walkup" : "subject")}
          busy={busy}
          error={error}
        />
      ) : null}

      {view === "done" && result ? (
        <DoneView
          result={result}
          onDone={reset}
          onUndo={() => undo(result)}
          canReturn={canReturn}
        />
      ) : null}
    </RouteShell>
  );
}

export default IssueDesk;
