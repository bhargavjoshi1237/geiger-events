
export const TICKET_SELECTION_DEFAULTS = {
  enabled: false,
  mode: "both",
  seatsLabel: "Seat selection via the seating plan",
  priceLabel: "Selection by price",
  features: ["plan", "insurance", "digital"],
  autoAssignNote:
    "The system automatically assigns you our best available seats at the time of your booking. However, if you would like a specific area, please select it.",
  soldOutNote:
    "No seats available. Seats may be put back on sale at a later date.",
};

export function ticketSelectionConfig(event) {
  return { ...TICKET_SELECTION_DEFAULTS, ...(event?.ticketSelection || {}) };
}

export function ticketSelectionActive(event) {
  const cfg = ticketSelectionConfig(event);
  if (!cfg.enabled) return null;
  const seatsOn = Boolean(event?.seating?.seatMapId);
  const mode = ["both", "seats", "price"].includes(cfg.mode)
    ? cfg.mode
    : "both";
  return {
    ...cfg,
    mode: mode === "seats" && !seatsOn ? "price" : mode,
    seatsOn,
  };
}
