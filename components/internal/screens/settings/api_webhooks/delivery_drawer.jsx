"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Repeat, RotateCcw } from "lucide-react";

import { StatusPill } from "@/components/internal/shared/screen_kit";
import { LogoLoading } from "@geiger/ui";
import { Button } from "@geiger/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@geiger/ui/sheet";
import { MAX_ATTEMPTS, webhookEnvelope } from "@/lib/api_webhooks/catalog";
import { getWebhookDelivery } from "@/lib/supabase/api_webhooks";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code_block";
import {
  DELIVERY_STATUS_MAP,
  ORIGIN_LABELS,
  copyText,
  eventTypeLabel,
  formatDateTime,
  formatUntil,
} from "./constants";

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-text-secondary">{label}</span>
      <span className={cn("min-w-0 break-all text-right text-foreground", mono && "font-mono text-xs leading-5")}>
        {value}
      </span>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-4">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-secondary">{title}</p>
      {children}
    </div>
  );
}

function prettyBody(text) {
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function DeliveryBody({ summary, canManage, onRetry, onReplay }) {
  const [detail, setDetail] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    getWebhookDelivery(summary.id).then((row) => {
      if (!alive) return;
      setDetail(row);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [summary.id, summary.attempts, summary.status]);

  const d = detail || summary;
  const envelope = detail?.event
    ? webhookEnvelope({
        id: detail.event.id,
        type: detail.event.type,
        occurredAt: detail.event.occurredAt,
        projectId: detail.event.projectId,
        data: detail.event.payload,
      })
    : null;
  const payload = envelope ? JSON.stringify(envelope, null, 2) : "";

  async function run(kind, action) {
    setBusy(kind);
    await action(summary);
    setBusy(null);
  }

  return (
    <>
      <SheetHeader className="border-b border-border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle className="text-base">{eventTypeLabel(d.eventType)}</SheetTitle>
          <StatusPill status={d.status} map={DELIVERY_STATUS_MAP} />
        </div>
        <SheetDescription className="break-all font-mono text-xs">{d.endpointUrl || "Deleted endpoint"}</SheetDescription>
        {canManage ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {d.status !== "succeeded" ? (
              <Button variant="outline" size="sm" onClick={() => run("retry", onRetry)} disabled={!!busy}>
                {busy === "retry" ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                Retry now
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => run("replay", onReplay)} disabled={!!busy}>
              {busy === "replay" ? <Loader2 className="size-3.5 animate-spin" /> : <Repeat className="size-3.5" />}
              Replay
            </Button>
            {payload ? (
              <Button variant="ghost" size="sm" onClick={() => copyText(payload, "Payload copied")}>
                <Copy className="size-3.5" />
                Copy payload
              </Button>
            ) : null}
          </div>
        ) : null}
      </SheetHeader>

      <div className="space-y-5 p-5">
        <Card title="Delivery">
          <div className="divide-y divide-border">
            <DetailRow label="Event type" value={d.eventType} mono />
            <DetailRow label="Event ID" value={d.eventId} mono />
            <DetailRow label="Delivery ID" value={d.id} mono />
            <DetailRow
              label="Source"
              value={d.replayOf ? `Replay of ${String(d.replayOf).slice(0, 8)}` : ORIGIN_LABELS[d.origin] || "Event"}
            />
            <DetailRow label="Attempts" value={`${d.attempts} of ${Math.max(MAX_ATTEMPTS, d.attempts)}`} />
            {d.status === "failed" && d.nextAttemptAt ? (
              <DetailRow label="Next retry" value={`${formatUntil(d.nextAttemptAt)} · ${formatDateTime(d.nextAttemptAt)}`} />
            ) : null}
            {d.deliveredAt ? <DetailRow label="Delivered" value={formatDateTime(d.deliveredAt)} /> : null}
            <DetailRow label="Created" value={formatDateTime(d.createdAt)} />
          </div>
        </Card>

        <Card title="Last response">
          <div className="divide-y divide-border">
            <DetailRow label="Status" value={d.responseStatus ? `HTTP ${d.responseStatus}` : "No response"} />
            <DetailRow label="Time" value={d.responseMs != null ? `${d.responseMs} ms` : "—"} />
            {d.lastError ? <DetailRow label="Error" value={d.lastError} /> : null}
          </div>
          {!loaded ? (
            <div className="flex justify-center py-4">
              <LogoLoading size={36} aria-label="Loading response" />
            </div>
          ) : detail?.responseBody ? (
            <CodeBlock className="mt-2" label="Body (first 2 KB)" code={prettyBody(detail.responseBody)} maxHeight="max-h-56" />
          ) : null}
        </Card>

        {detail?.attemptLog?.length ? (
          <Card title="Attempts">
            <ol className="divide-y divide-border">
              {detail.attemptLog.map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="text-text-secondary">
                    #{a.attempt} · {formatDateTime(a.at)}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 text-right",
                      a.status >= 200 && a.status < 300 && !a.error
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {a.error || (a.status ? `HTTP ${a.status}` : "—")}
                    {a.ms != null ? <span className="text-text-tertiary"> · {a.ms} ms</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        ) : null}

        <Card title="Request">
          <div className="divide-y divide-border">
            <DetailRow label="Method" value="POST" mono />
            <DetailRow label="Geiger-Event-Id" value={d.eventId} mono />
            <DetailRow label="Geiger-Event-Type" value={d.eventType} mono />
            <DetailRow label="Geiger-Signature" value="t=…,v1=… (signed per attempt)" mono />
          </div>
          {!loaded ? null : payload ? (
            <CodeBlock className="mt-2" label="Body" code={payload} copyMessage="Payload copied" />
          ) : (
            <p className="pt-2 text-xs text-text-tertiary">The event payload is no longer stored (kept for 30 days).</p>
          )}
        </Card>
      </div>
    </>
  );
}

export default function DeliveryDrawer({ delivery, canManage, onOpenChange, onRetry, onReplay }) {
  return (
    <Sheet open={!!delivery} onOpenChange={(open) => !open && onOpenChange(false)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {delivery ? (
          <DeliveryBody
            key={delivery.id}
            summary={delivery}
            canManage={canManage}
            onRetry={onRetry}
            onReplay={onReplay}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
