"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CloudOff, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { shortDeviceId } from "@/lib/checkin/offline/device";

function ago(iso, now) {
  if (!iso) return "";
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 12) return `${h}h ago`;
  return new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const TONES = {
  online: "border-border bg-surface-subtle text-text-secondary",
  offline: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  danger: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
};

// The always-visible connection strip for staff routes: online/offline, queue, last sync, guest-list age, Sync now.
export function OfflineBanner({ status, onSync, className }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  if (!status || status.booting) return null;

  const { online, enabled, ready, queued, failed, syncing, refreshing } = status;
  const noList = !online && !ready;
  const tone = noList || status.lastError ? "danger" : online ? "online" : "offline";
  const Icon = noList ? CloudOff : online ? Wifi : WifiOff;

  const headline = syncing
    ? "Syncing…"
    : online
      ? "Online"
      : ready
        ? "Offline — scanning from this device's guest list"
        : enabled === false
          ? "Offline — offline mode is off for this event"
          : "Offline — no guest list on this device";

  const parts = [];
  if (ready) {
    parts.push(`${status.ticketCount.toLocaleString("en-US")} tickets cached ${ago(status.snapshotAt, now)}`);
  } else if (online && enabled === false) {
    parts.push("Offline mode off for this event");
  }
  if (queued > 0) parts.push(`${queued} queued`);
  if (failed > 0) parts.push(`${failed} couldn't sync`);
  parts.push(status.lastSyncAt ? `Synced ${ago(status.lastSyncAt, now)}` : queued > 0 ? "Not synced yet" : "");
  if (status.conflicts > 0) parts.push(`${status.conflicts} sent for review`);
  if (!status.storage) parts.push("This browser can't store scans — keep this tab open");

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2 text-xs sm:px-6", TONES[tone], className)}
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        {status.lastError ? <AlertTriangle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
        {status.lastError || headline}
      </span>
      <span className="min-w-0 flex-1 truncate tabular-nums opacity-90">
        {parts.filter(Boolean).join(" · ")}
      </span>
      {status.deviceId ? (
        <span className="hidden font-mono opacity-70 sm:inline" title="This device's id in Offline Check-in">
          {shortDeviceId(status.deviceId)}
        </span>
      ) : null}
      {onSync ? (
        <button
          type="button"
          onClick={onSync}
          disabled={syncing || refreshing}
          className="inline-flex items-center gap-1 rounded-md border border-current/20 px-2 py-1 font-medium transition-colors hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/5"
        >
          {syncing || refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sync now
        </button>
      ) : null}
    </div>
  );
}

export default OfflineBanner;
