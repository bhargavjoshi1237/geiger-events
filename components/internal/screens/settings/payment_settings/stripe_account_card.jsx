"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Info, Loader2, RefreshCw, Unplug } from "lucide-react";
import { CONNECT_COUNTRIES } from "@geiger/pay";
import { AccountStatusBadge } from "@geiger/pay/react";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";

import { SectionCard } from "@/components/internal/shared/screen_kit";
import { accountRows, countryName, isConnected, needsSetup } from "./status";

// Only rendered after the client-side settings fetch, so reading navigator can't cause a hydration mismatch.
function detectCountry() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    if (CONNECT_COUNTRIES.some((item) => item.code === region)) return region;
  } catch {}
  return "US";
}

export function StripeAccountCard({ account, canManage, stripe }) {
  const [country, setCountry] = useState(detectCountry);
  const [confirming, setConfirming] = useState(false);
  const connected = isConnected(account);

  let notice = null;
  if (!canManage && !connected) notice = "Only organization owners can connect Stripe.";
  else if (!canManage && needsSetup(account)) notice = "Only organization owners can finish Stripe setup.";

  let meta = "Ticket checkout needs a connected Stripe account.";
  if (connected) meta = null;
  else if (canManage) meta = "Choose where your business is based. This can't be changed later.";

  return (
    <SectionCard
      title="Stripe"
      description="Ticket payments are paid out to your organization's Stripe account."
      bodyPadding={false}
    >
      <div className="divide-y divide-border">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
              <CreditCard className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {connected ? account.displayName || "Stripe account" : "No account connected"}
                </p>
                <AccountStatusBadge status={account?.status} />
                {connected && account.livemode === false ? <Badge variant="outline">Test mode</Badge> : null}
              </div>
              <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-text-secondary">
                {connected ? (
                  <>
                    {account.country ? <span>{countryName(account.country)}</span> : null}
                    <span className="truncate font-mono">{account.stripeAccountId}</span>
                  </>
                ) : (
                  meta
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {!connected && canManage ? (
              <>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger size="sm" className="w-44" aria-label="Business country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONNECT_COUNTRIES.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground"
                  onClick={() => stripe.connect(country)}
                  disabled={stripe.isPending}
                >
                  {stripe.busy("connect") ? <Loader2 className="animate-spin" /> : null}
                  Connect Stripe
                </Button>
              </>
            ) : null}
            {connected && canManage && needsSetup(account) ? (
              <Button
                size="sm"
                className="bg-primary text-primary-foreground"
                onClick={() => stripe.connect(account.country || country)}
                disabled={stripe.isPending}
              >
                {stripe.busy("connect") ? <Loader2 className="animate-spin" /> : null}
                Continue setup
              </Button>
            ) : null}
            {connected && account.dashboardUrl ? (
              <Button size="sm" variant="outline" asChild>
                <a href={account.dashboardUrl} target="_blank" rel="noreferrer">
                  Stripe Dashboard
                  <ExternalLink />
                </a>
              </Button>
            ) : null}
            {connected ? (
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-text-secondary"
                onClick={stripe.refresh}
                disabled={stripe.isPending}
                aria-label="Refresh status"
                title="Refresh status"
              >
                {stripe.busy("refresh") ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              </Button>
            ) : null}
            {connected && canManage ? (
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-text-secondary hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                onClick={() => setConfirming(true)}
                disabled={stripe.isPending}
                aria-label="Disconnect Stripe"
                title="Disconnect Stripe"
              >
                <Unplug />
              </Button>
            ) : null}
          </div>
        </div>

        {connected
          ? accountRows(account).map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-text-secondary">{row.label}</span>
                <span className="text-right text-foreground">{row.value}</span>
              </div>
            ))
          : null}

        {notice ? (
          <p className="flex items-center gap-2 px-4 py-3 text-xs text-text-secondary">
            <Info className="size-3.5 shrink-0 text-text-tertiary" />
            {notice}
          </p>
        ) : null}
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !stripe.isPending && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Stripe?</DialogTitle>
            <DialogDescription>
              Your Geiger apps will stop taking payments for this organization. Past payments and your Stripe account
              stay as they are. To remove Geiger&apos;s access completely, also revoke it from your Stripe Dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={stripe.isPending}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => stripe.disconnect(() => setConfirming(false))}
              disabled={stripe.isPending}
            >
              {stripe.busy("disconnect") ? <Loader2 className="size-4 animate-spin" /> : null}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
