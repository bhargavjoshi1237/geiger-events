"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, CreditCard, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import { ACCOUNT_STATUS } from "@geiger/pay";
import { StripeConnectCard } from "@geiger/pay/react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader, EmptyState, SectionCard, SettingRow } from "@/components/internal/shared/screen_kit";
import { LogoLoading } from "@geiger/ui";
import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { useProject } from "@/context/project-context";
import { cn } from "@/lib/utils";
import {
  connectStripe,
  disconnectStripe,
  getPaymentSettings,
  refreshStripe,
  setDemoMode,
} from "@/lib/pay/client";

const RETURN_TOASTS = {
  [ACCOUNT_STATUS.ACTIVE]: () => toast.success("Stripe is connected."),
  [ACCOUNT_STATUS.PENDING]: () => toast("Stripe is reviewing your details. This usually takes a few minutes."),
  [ACCOUNT_STATUS.ACTION_REQUIRED]: () => toast("Stripe still needs a few details. Select Continue setup to finish."),
  [ACCOUNT_STATUS.REJECTED]: () => toast.error("Stripe couldn't verify this account. Open the Stripe Dashboard to see why."),
};

// Stripe sends people back with ?stripe=return (finished or left) or ?stripe=refresh (the link expired).
function readStripeStep() {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("stripe");
}

function routingView({ demoMode, account }) {
  if (demoMode) {
    return {
      icon: FlaskConical,
      tone: "border-sky-500/25 bg-sky-500/10",
      iconTone: "text-sky-600 dark:text-sky-400",
      title: "Demo mode is on",
      note: "Ticket checkouts run in Geiger's Stripe sandbox. Buyers pay with test cards such as 4242 4242 4242 4242, no money is collected, and tickets are still issued.",
    };
  }
  if (account?.status === ACCOUNT_STATUS.ACTIVE) {
    return {
      icon: CircleCheck,
      tone: "border-emerald-500/25 bg-emerald-500/10",
      iconTone: "text-emerald-600 dark:text-emerald-400",
      title: "Ticket sales go to your Stripe account",
      note: "Buyers pay on Stripe's checkout and the money lands in your organization's Stripe balance.",
    };
  }
  return {
    icon: CircleAlert,
    tone: "border-amber-500/25 bg-amber-500/10",
    iconTone: "text-amber-600 dark:text-amber-400",
    title: "Online ticket sales are paused",
    note: "Connect Stripe and finish its setup, or turn on demo mode to try checkout with test cards.",
  };
}

function CheckoutRouting({ demoMode, account }) {
  const view = routingView({ demoMode, account });
  const Icon = view.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", view.tone)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", view.iconTone)} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{view.title}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{view.note}</p>
      </div>
    </div>
  );
}

function DemoModeCard({ settings, onChange }) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const { demoMode, demoAvailable, canManage } = settings;

  async function save(next) {
    setSaving(true);
    const ok = await onChange(next);
    setSaving(false);
    if (ok) setConfirming(false);
  }

  let description = "Run this project's ticket checkout in Geiger's Stripe sandbox while you set up or rehearse. No real money moves.";
  if (!demoAvailable) description = "Geiger's demo sandbox isn't configured for this site.";
  else if (!canManage) description += " Only organization owners can change this.";

  return (
    <SectionCard title="Demo mode" description="Try ticket checkout end to end with Stripe test cards.">
      <SettingRow
        icon={FlaskConical}
        title="Process payments in Geiger's demo sandbox"
        description={description}
        control={
          <div className="flex items-center gap-2">
            {saving ? <Loader2 className="size-4 animate-spin text-text-secondary" /> : null}
            <Switch
              checked={demoMode}
              disabled={saving || !canManage || (!demoAvailable && !demoMode)}
              aria-label="Demo mode"
              onCheckedChange={(next) => (next ? setConfirming(true) : save(false))}
            />
          </div>
        }
      />

      <Dialog open={confirming} onOpenChange={(open) => !saving && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn on demo mode?</DialogTitle>
            <DialogDescription>
              Every ticket checkout in this project will use Geiger&apos;s Stripe sandbox instead of your Stripe account.
              Anyone can get tickets with a test card and no money is collected, so only use it before tickets go on
              sale.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={() => save(true)} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Turn on demo mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

export function PaymentsSettingsScreen() {
  const { project, loading: projectLoading } = useProject();
  const projectId = project?.id || null;
  const hasOrganization = Boolean(project?.organization_id);
  const [state, setState] = useState({ loading: true, settings: null, error: null });
  const [stripeStep] = useState(readStripeStep);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!stripeStep) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("stripe");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [stripeStep]);

  useEffect(() => {
    if (!projectId || !hasOrganization) return;
    let alive = true;
    getPaymentSettings(projectId, { refresh: stripeStep === "return" }).then((result) => {
      if (!alive) return;
      if (result.error) {
        setState({ loading: false, settings: null, error: result.error.message });
        return;
      }
      setState({ loading: false, settings: result, error: null });
      if (attempt > 0) return;
      if (stripeStep === "return") RETURN_TOASTS[result.account?.status]?.();
      if (stripeStep === "refresh") toast("Your Stripe setup link expired. Select Continue setup to carry on.");
    });
    return () => {
      alive = false;
    };
  }, [projectId, hasOrganization, stripeStep, attempt]);

  const retry = () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setAttempt((count) => count + 1);
  };

  const patchSettings = useCallback(
    (patch) =>
      setState((current) => (current.settings ? { ...current, settings: { ...current.settings, ...patch } } : current)),
    [],
  );

  const handleConnect = useCallback((input) => connectStripe(projectId, input), [projectId]);
  const handleRefresh = useCallback(async () => {
    const result = await refreshStripe(projectId);
    if (!result?.error) patchSettings({ account: result });
    return result;
  }, [projectId, patchSettings]);
  const handleDisconnect = useCallback(async () => {
    const result = await disconnectStripe(projectId);
    if (!result?.error) {
      patchSettings({ account: result });
      toast.success("Stripe disconnected");
    }
    return result;
  }, [projectId, patchSettings]);

  async function handleDemoMode(next) {
    const result = await setDemoMode(projectId, next);
    if (result.error) {
      toast.error(result.error.message);
      return false;
    }
    patchSettings({ demoMode: result.demoMode });
    toast.success(result.demoMode ? "Demo mode is on" : "Demo mode is off");
    return true;
  }

  let body;
  if (!projectLoading && !hasOrganization) {
    body = (
      <EmptyState
        icon={CreditCard}
        title="No organization for this project"
        description="Payments connect to an organization. Open a project that belongs to one to set up Stripe."
      />
    );
  } else if (state.loading) {
    body = (
      <div className="flex justify-center py-10">
        <LogoLoading size={48} label="Loading payments" />
      </div>
    );
  } else if (state.error) {
    body = (
      <EmptyState
        icon={CircleAlert}
        title="Couldn't load payments"
        description={state.error}
        action={
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        }
      />
    );
  } else {
    const { settings } = state;
    body = (
      <>
        <CheckoutRouting demoMode={settings.demoMode} account={settings.account} />
        <StripeConnectCard
          account={settings.account}
          canManage={settings.canManage}
          onConnect={handleConnect}
          onRefresh={handleRefresh}
          onDisconnect={handleDisconnect}
        />
        <DemoModeCard settings={settings} onChange={handleDemoMode} />
      </>
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Payments"
        description="Choose where ticket sales are paid: your organization's own Stripe account, or Geiger's demo sandbox while you try things out."
      />

      {body}

      <p className="text-xs text-text-secondary">
        The Stripe connection belongs to your organization, so every Geiger app uses the same account. Demo mode is set
        per project. Only organization owners can change either.
      </p>
    </MainScreenWrapper>
  );
}

export default PaymentsSettingsScreen;
