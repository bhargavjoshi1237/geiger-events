"use client";

import { SeatPicker } from "../../seat_picker";

// The seating step is a map plus an offers rail, so it takes the full width AND
// the full height of the checkout dialog. Every control it needs — the way
// back, "best available", the hold countdown, confirm — already lives inside
// the picker, so this step adds no chrome of its own to crowd the map.
export function SeatsStep({ event, checkout, accent }) {
  const {
    seating,
    seatMode,
    ticket,
    qty,
    setQty,
    seatSel,
    setSeatSel,
    busy,
    setStep,
    confirmSeats,
  } = checkout;

  return (
    <SeatPicker
      event={event}
      seating={seating}
      tickets={event?.tickets || []}
      ticketId={seatMode === "type-first" ? ticket?.id ?? null : null}
      requiredQty={seatMode === "type-first" ? qty : 0}
      accent={accent}
      onConfirm={confirmSeats}
      confirmLabel={seatMode === "type-first" ? "Confirm seats" : "Reserve seats"}
      onBack={seatMode === "type-first" ? () => !busy && setStep("details") : undefined}
      // Coming back to this step resumes the hold rather than starting a new
      // one, so the buyer's own seats aren't waiting for them as "sold".
      initialSelection={seatSel}
      onChange={(sel) => {
        setSeatSel(sel);
        if (seatMode === "map-first" && sel.seatIds.length) {
          setQty(sel.seatIds.length);
        }
      }}
    />
  );
}
