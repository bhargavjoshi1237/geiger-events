"use client";

import { ArrowLeft, ChevronRight, Loader2, Lock } from "lucide-react";

import { Button } from "@geiger/ui/button";

import { TicketAddonsStep } from "../../ticket_addons_step";
import { AddonsTotals } from "./order_totals";
import { PurchaseGateInline } from "./purchase_gate";

// Add-ons (or, with none, the organiser's terms) on the left; the summary and the pay button on the right, like Details.
export function AddonsStep({ event, checkout, accent, accentStyle }) {
  const {
    visiblePurs,
    purSelections,
    togglePurchasable,
    setPurchasableQty,
    busy,
    setStep,
    flowSteps,
    confirmAddons,
    requiresApproval,
    approvedResume,
    isFree,
    hasAddons,
    gateCfg,
    gateStep,
    gateReady,
    gateChecked,
    setGateChecked,
  } = checkout;

  const gate =
    gateStep === "addons" ? (
      <PurchaseGateInline cfg={gateCfg} checked={gateChecked} onCheckedChange={setGateChecked} />
    ) : null;
  const here = flowSteps.findIndex((s) => s.id === "addons");
  const back = flowSteps[here - 1]?.id || "details";

  return (
    <div className="grid gap-6 md:grid-cols-2 md:items-start">
      <div className="grid content-start gap-4">
        {hasAddons ? (
          <TicketAddonsStep
            purchasables={visiblePurs}
            selections={purSelections}
            onToggle={togglePurchasable}
            onQty={setPurchasableQty}
            accent={accent}
          />
        ) : (
          gate
        )}
      </div>

      <div className="grid content-start gap-4 md:border-l md:border-border md:pl-6">
        <AddonsTotals event={event} checkout={checkout} />

        {hasAddons ? gate : null}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            disabled={busy}
            onClick={() => setStep(back)}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            style={gateReady ? accentStyle : undefined}
            className="flex-1 hover:opacity-90 disabled:opacity-50"
            disabled={busy || !gateReady}
            onClick={confirmAddons}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : requiresApproval && !approvedResume ? (
              "Request to register"
            ) : isFree ? (
              "Complete registration"
            ) : gateCfg && !gateCfg.requireCheck ? (
              gateCfg.confirmLabel || "Agree & continue"
            ) : (
              <>
                Continue To Payment <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {!isFree && !(requiresApproval && !approvedResume) ? (
          <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
            <Lock className="h-3 w-3" /> Payments are securely processed by Stripe.
          </p>
        ) : null}
      </div>
    </div>
  );
}
