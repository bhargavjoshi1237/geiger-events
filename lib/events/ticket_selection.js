// Selection-mode presentation for the public tickets card: buyers either pick
// seats through the seating plan or choose a ticket by price. Persists as
// `event.metadata.ticketSelection` via useEventConfig; both the editor section
// (events/ticket_selection.jsx) and the public RegisterCard read through
// ticketSelectionConfig / ticketSelectionActive so defaults stay in one place.
//
//   ticketSelection = {
//     enabled: bool,
//     mode: "both" | "seats" | "price",
//     seatsLabel, priceLabel: string,         // button captions
//     features: string[],                     // feature-highlight chip ids
//     autoAssignNote, soldOutNote: string,    // numbered footnotes ("" hides)
//   }

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

// Resolves the config into what the public card should actually render. Returns
// null when the feature is off. A seat-plan button without a configured seat
// map would dead-end, so a seats-only mode collapses to price-only.
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
