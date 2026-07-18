// Optional donations at ticket checkout.
//
// Config lives in the event metadata bag (metadata.donation), gated by the
// per-event ticketRules.donation flag. When enabled the checkout shows a donation
// prompt (suggested amounts + optional custom entry); the chosen amount is added
// to the order total ONCE (not multiplied by ticket quantity) and recorded on the
// order metadata. Pure functions — no React, no DB.
//
//   metadata.donation = {
//     cause, suggestedAmounts:[…], allowCustom, minAmount, prompt, required,
//   }

export const EMPTY_DONATION = {
  cause: "",
  suggestedAmounts: [5, 10, 25],
  allowCustom: true,
  minAmount: 1,
  prompt: "",
  required: false,
};

export function normalizeDonation(cfg) {
  const c = { ...EMPTY_DONATION, ...(cfg || {}) };
  return {
    ...c,
    suggestedAmounts: Array.isArray(c.suggestedAmounts)
      ? c.suggestedAmounts.map((n) => Number(n) || 0).filter((n) => n > 0)
      : [],
    allowCustom: c.allowCustom !== false,
    minAmount: Number(c.minAmount) || 0,
    required: !!c.required,
  };
}

export function donationEnabled(event) {
  return !!event?.ticketRules?.donation;
}

export function donationConfig(event) {
  return normalizeDonation(event?.donation);
}

// Clamp a buyer-entered amount to the configured minimum (0 stays 0 when the
// donation is optional). Returns a cents-rounded, non-negative number.
export function clampDonation(event, amount) {
  const c = donationConfig(event);
  const n = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  if (n === 0) return 0;
  return Math.max(n, c.minAmount);
}
