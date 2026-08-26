"use client";

import { SeatPicker } from "../../seat_picker";

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
