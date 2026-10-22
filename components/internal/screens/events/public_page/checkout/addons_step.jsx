"use client";

import { ArrowLeft, ChevronRight, Loader2, Lock } from "lucide-react";

import { Button } from "@geiger/ui/button";

import { buildPurchasableSelections } from "@/lib/events/purchasables";
import { currency } from "@/components/internal/screens/tickets/constants";

import { TicketAddonsStep } from "../../ticket_addons_step";

// Extras only, with a running total; the full summary and any terms wait for the Review step.
export function AddonsStep({ checkout, accent, accentStyle }) {
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
    reviewOn,
    total,
    qty,
  } = checkout;

  const here = flowSteps.findIndex((s) => s.id === "addons");
  const back = flowSteps[here - 1]?.id || "details";
  const extras = buildPurchasableSelections(visiblePurs, purSelections).reduce(
    (n, p) => n + p.quantity,
    0,
  );
  const handsOff = !reviewOn && !isFree && !(requiresApproval && !approvedResume);

  return (
    <div className="grid gap-5">
      <TicketAddonsStep
        purchasables={visiblePurs}
        selections={purSelections}
        onToggle={togglePurchasable}
        onQty={setPurchasableQty}
        accent={accent}
      />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
            Total
          </p>
          <p className="text-xl font-bold leading-tight tabular-nums text-foreground">
            {total === 0 ? "Free" : currency(total)}
          </p>
          <p className="text-xs text-text-tertiary">
            {qty} ticket{qty === 1 ? "" : "s"}
            {extras ? ` + ${extras} extra${extras === 1 ? "" : "s"}` : ""}
          </p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            disabled={busy}
            onClick={() => setStep(back)}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            style={accentStyle}
            className="flex-1 hover:opacity-90 sm:min-w-[12rem]"
            disabled={busy}
            onClick={confirmAddons}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : reviewOn ? (
              <>
                Review order <ChevronRight className="h-4 w-4" />
              </>
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
      </div>

      {handsOff ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
          <Lock className="h-3 w-3" /> Payments are securely processed by Stripe.
        </p>
      ) : null}
    </div>
  );
}
