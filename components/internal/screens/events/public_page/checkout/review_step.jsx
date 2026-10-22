"use client";

import { ArrowLeft, ChevronRight, Loader2, Lock } from "lucide-react";

import { Button } from "@geiger/ui/button";

import { OrderSummary } from "./order_totals";
import { PurchaseGateInline } from "./purchase_gate";

// The last stop before payment: what they're buying on the left, the organiser's terms and Pay on the right.
export function ReviewStep({ event, checkout, accentStyle }) {
  const {
    busy,
    setStep,
    flowSteps,
    confirmReview,
    requiresApproval,
    approvedResume,
    isFree,
    gateCfg,
    gateReady,
    gateChecked,
    setGateChecked,
  } = checkout;

  const here = flowSteps.findIndex((s) => s.id === "review");
  const back = flowSteps[here - 1]?.id || "details";
  const approval = requiresApproval && !approvedResume;

  return (
    <div className="grid gap-6 md:grid-cols-2 md:items-start">
      <OrderSummary event={event} checkout={checkout} />

      <div className="grid content-start gap-4 md:border-l md:border-border md:pl-6">
        <PurchaseGateInline
          cfg={gateCfg}
          checked={gateChecked}
          onCheckedChange={setGateChecked}
          boxClassName="max-h-64"
        />

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
            onClick={confirmReview}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : approval ? (
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

        {!isFree && !approval ? (
          <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
            <Lock className="h-3 w-3" /> Payments are securely processed by Stripe.
          </p>
        ) : null}
      </div>
    </div>
  );
}
