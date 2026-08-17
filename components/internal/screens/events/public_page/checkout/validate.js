import { toast } from "sonner";

import { seatKey, isTicketAnswerBlank } from "./order_payload";

export function validateCheckoutDetails({
  name,
  email,
  qty,
  slotRequired,
  bookableSlots,
  selectedSlot,
  isGroup,
  attendees,
  offerings,
  selections,
  regQuestions,
  answers,
  inquiryQuestions,
  inquiryKey,
  ticketQuestions,
  ticketAnswers,
}) {
  if (!name.trim()) {
    toast.error("Please enter your name.");
    return false;
  }
  if (!email.includes("@")) {
    toast.error("Please enter a valid email.");
    return false;
  }
  if (slotRequired && bookableSlots.length && !selectedSlot) {
    toast.error("Please choose a time slot.");
    return false;
  }
  if (isGroup) {
    for (let i = 0; i < qty; i += 1) {
      if (!(attendees[i]?.email || "").includes("@")) {
        toast.error(`Enter a valid email for attendee ${i + 1}.`);
        return false;
      }
    }
  }
  const missing = offerings.find(
    (o) => o.required && o.selectionType === "single" && !selections[o.id],
  );
  if (missing) {
    toast.error(`Please choose an option for ${missing.name}.`);
    return false;
  }
  const missingQ = regQuestions.find((q) => {
    if (!q.required) return false;
    const v = answers[q.id];
    return v === undefined || v === "" || v === false;
  });
  if (missingQ) {
    toast.error(`Please answer "${missingQ.label}".`);
    return false;
  }
  const missingInq = inquiryQuestions.find((q) => {
    if (!q.required) return false;
    const v = answers[inquiryKey(q)];
    if (Array.isArray(v)) return v.length === 0;
    return v === undefined || v === "";
  });
  if (missingInq) {
    toast.error(`Please answer "${missingInq.label}".`);
    return false;
  }
  for (let seat = 0; seat < qty; seat++) {
    const missingT = ticketQuestions.find(
      (q) => q.required && isTicketAnswerBlank(ticketAnswers[seatKey(seat, q.id)]),
    );
    if (missingT) {
      toast.error(
        qty > 1
          ? `Please answer "${missingT.label}" for attendee ${seat + 1}.`
          : `Please answer "${missingT.label}".`,
      );
      return false;
    }
  }
  return true;
}
