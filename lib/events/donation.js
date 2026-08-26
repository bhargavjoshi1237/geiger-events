
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

export function clampDonation(event, amount) {
  const c = donationConfig(event);
  const n = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  if (n === 0) return 0;
  return Math.max(n, c.minAmount);
}
