"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Smartphone } from "lucide-react";

import { StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@geiger/ui/sheet";
import { cn } from "@/lib/utils";
import {
  PUSH_STATUS_MAP,
  RECEIPT_STATUS_MAP,
  TICKET_STATUS_MAP,
  canRetry,
  categoryLabel,
  formatDateTime,
  platformLabel,
  skipReasonLabel,
  typeLabel,
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

function recipientLine(item) {
  if (item.memberName && item.memberEmail) return `${item.memberName} · ${item.memberEmail}`;
  return item.memberName || item.memberEmail || "Unknown member";
}

function noDevicesNote(item) {
  if (item.status === "skipped") return "It was skipped, so nothing went to a device.";
  if (item.status === "failed") return "No device took it. The last error says why.";
  if (item.status === "sent") return "No device deliveries are on record for it.";
  return "Nothing has gone to a device yet.";
}

function DeviceRow({ delivery }) {
  return (
    <li className="space-y-1.5 py-3 first:pt-2 last:pb-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-foreground">
          <Smartphone className="size-3.5 text-text-tertiary" />
          {platformLabel(delivery.platform)}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {delivery.status ? <StatusPill status={delivery.status} map={TICKET_STATUS_MAP} /> : null}
          {delivery.receiptStatus ? <StatusPill status={delivery.receiptStatus} map={RECEIPT_STATUS_MAP} /> : null}
        </span>
      </div>
      {delivery.error ? (
        <p className="break-words font-mono text-xs leading-5 text-red-600 dark:text-red-400">{delivery.error}</p>
      ) : null}
      {delivery.receiptError ? (
        <p className="break-words font-mono text-xs leading-5 text-red-600 dark:text-red-400">
          Receipt: {delivery.receiptError}
        </p>
      ) : null}
      <p className="text-[11px] text-text-tertiary">{formatDateTime(delivery.createdAt)}</p>
    </li>
  );
}

function DrawerBody({ item, canManage, onRetry }) {
  const [busy, setBusy] = useState(false);
  const deliveries = item.deliveries || [];
  const written = Boolean(item.title || item.body);

  async function retry() {
    setBusy(true);
    await onRetry(item);
    setBusy(false);
  }

  return (
    <>
      <SheetHeader className="border-b border-border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle className="text-base">{typeLabel(item.type)}</SheetTitle>
          <StatusPill status={item.status} map={PUSH_STATUS_MAP} />
        </div>
        <SheetDescription className="break-all text-xs">{recipientLine(item)}</SheetDescription>
        {canManage && canRetry(item) ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={retry} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              Retry
            </Button>
          </div>
        ) : null}
      </SheetHeader>

      <div className="space-y-5 p-5">
        <Card title="Message">
          {written ? (
            <div className="space-y-1 py-2">
              {item.title ? <p className="text-sm font-medium text-foreground">{item.title}</p> : null}
              {item.body ? (
                <p className="whitespace-pre-wrap break-words text-sm text-text-secondary">{item.body}</p>
              ) : null}
            </div>
          ) : (
            <p className="py-2 text-sm text-text-tertiary">
              {item.status === "skipped"
                ? "Never written: it was skipped before sending."
                : "Written when it sends, so it carries the latest details."}
            </p>
          )}
        </Card>

        <Card title="Delivery">
          <div className="divide-y divide-border">
            <DetailRow label="Type" value={item.type} mono />
            {item.category ? <DetailRow label="Category" value={categoryLabel(item.category)} /> : null}
            {item.status === "skipped" ? (
              <DetailRow label="Skipped because" value={skipReasonLabel(item.skipReason)} />
            ) : null}
            <DetailRow label="Attempts" value={String(item.attempts ?? 0)} />
            <DetailRow label="Created" value={formatDateTime(item.createdAt)} />
            {item.sendAfter ? <DetailRow label="Send after" value={formatDateTime(item.sendAfter)} /> : null}
            {item.sentAt ? <DetailRow label="Sent" value={formatDateTime(item.sentAt)} /> : null}
            <DetailRow label="Push ID" value={item.id} mono />
          </div>
        </Card>

        {item.lastError ? (
          <Card title="Last error">
            <p className="break-words py-2 font-mono text-xs leading-5 text-red-600 dark:text-red-400">
              {item.lastError}
            </p>
          </Card>
        ) : null}

        <Card title={deliveries.length ? `Devices · ${deliveries.length}` : "Devices"}>
          {deliveries.length ? (
            <ul className="divide-y divide-border">
              {deliveries.map((delivery, i) => (
                <DeviceRow key={`${delivery.createdAt}-${i}`} delivery={delivery} />
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-text-tertiary">{noDevicesNote(item)}</p>
          )}
        </Card>
      </div>
    </>
  );
}

export default function DeliveryDrawer({ item, canManage, onOpenChange, onRetry }) {
  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onOpenChange(false)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {item ? <DrawerBody key={item.id} item={item} canManage={canManage} onRetry={onRetry} /> : null}
      </SheetContent>
    </Sheet>
  );
}
