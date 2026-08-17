"use client";

import { Button } from "@/components/ui/button";

import { SeatPicker } from "../../seat_picker";

export function SeatsStep({ event, checkout, accent }) {
  const { seating, seatMode, ticket, qty, setQty, setSeatSel, seatSel, busy, setStep, confirmSeats } =
    checkout;

  return (
    <div className="grid gap-4">
      <SeatPicker
        event={event}
        seating={seating}
        tickets={event?.tickets || []}
        ticketId={seatMode === "type-first" ? ticket?.id ?? null : null}
        requiredQty={seatMode === "type-first" ? qty : 0}
        accent={accent}
        onChange={(sel) => {
          setSeatSel(sel);
          if (seatMode === "map-first" && sel.seatIds.length) {
            setQty(sel.seatIds.length);
          }
        }}
      />
      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        {seatMode === "type-first" ? (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setStep("details")}
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          disabled={busy || !seatSel?.seatIds?.length}
          onClick={confirmSeats}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          style={accent ? { backgroundColor: accent } : undefined}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
