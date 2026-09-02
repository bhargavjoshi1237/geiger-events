"use client";

import { ArrowLeft, ChevronRight, Loader2, Lock } from "lucide-react";

import { Button } from "@geiger/ui/button";

import { TicketAddonsStep } from "../../ticket_addons_step";
import { AddonsTotals } from "./order_totals";

export function AddonsStep({ checkout, accent, accentStyle }) {
  const {
    visiblePurs,
    purSelections,
    togglePurchasable,
    setPurchasableQty,
    busy,
    setStep,
    confirmAddons,
    requiresApproval,
    approvedResume,
    isFree,
  } = checkout;

  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <TicketAddonsStep
        purchasables={visiblePurs}
        selections={purSelections}
        onToggle={togglePurchasable}
        onQty={setPurchasableQty}
        accent={accent}
      />

      <AddonsTotals checkout={checkout} />

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          disabled={busy}
          onClick={() => setStep("details")}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          style={accentStyle}
          className="flex-1 hover:opacity-90"
          disabled={busy}
          onClick={confirmAddons}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : requiresApproval && !approvedResume ? (
            "Request to register"
          ) : isFree ? (
            "Complete registration"
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
  );
}
