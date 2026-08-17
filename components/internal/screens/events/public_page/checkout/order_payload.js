import { buildPurchasableSelections } from "@/lib/events/purchasables";

export const seatKey = (seat, qid) => `${seat}:${qid}`;

export const isTicketAnswerBlank = (v) =>
  v === undefined ||
  v === "" ||
  v === false ||
  (Array.isArray(v) && v.length === 0);

export function buildSelections(offerings, selections) {
  return offerings
    .map((o) => {
      const sel = selections[o.id];
      const ids =
        o.selectionType === "single"
          ? sel
            ? [sel]
            : []
          : Array.isArray(sel)
            ? sel
            : [];
      const choices = ids
        .map((id) => o.options.find((x) => x.id === id))
        .filter(Boolean)
        .map((opt) => ({ label: opt.label, price: Number(opt.price) || 0 }));
      return choices.length
        ? { offering: o.name, type: o.selectionType, choices }
        : null;
    })
    .filter(Boolean);
}

export function buildPurchasables(visiblePurs, purSelections) {
  return buildPurchasableSelections(visiblePurs, purSelections);
}

export function buildAttendees(isGroup, qty, attendees) {
  return isGroup
    ? Array.from({ length: qty }, (_, i) => ({
        name: (attendees[i]?.name || "").trim(),
        email: (attendees[i]?.email || "").trim(),
      }))
    : null;
}

export function slotRecord(selectedSlot) {
  return selectedSlot
    ? {
        id: selectedSlot.id,
        label: selectedSlot.label,
        band: selectedSlot.band,
        start: selectedSlot.start || "",
        priceDelta: Number(selectedSlot.priceDelta) || 0,
      }
    : null;
}

export function buildTicketAnswers(qty, ticketQuestions, ticketAnswers) {
  const out = [];
  for (let seat = 0; seat < qty; seat++) {
    for (const q of ticketQuestions) {
      const v = ticketAnswers[seatKey(seat, q.id)];
      if (isTicketAnswerBlank(v)) continue;
      out.push({ questionId: q.id, seatIndex: seat, value: v });
    }
  }
  return out;
}
