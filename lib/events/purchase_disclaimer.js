// The last word before a buyer commits: an acknowledgement gate on the final checkout button.
export const PURCHASE_DISCLAIMER_DEFAULTS = {
  enabled: false,
  title: "Before you buy",
  text: "",
  appliesTo: "all",
  requireCheck: true,
  checkLabel: "I have read and agree to the above",
  confirmLabel: "Agree & continue",
};

export function purchaseDisclaimerConfig(event) {
  return { ...PURCHASE_DISCLAIMER_DEFAULTS, ...(event?.purchaseDisclaimer || {}) };
}

// Null when the gate shouldn't show for this basket; `isFree` skips it under "paid only".
export function activePurchaseDisclaimer(event, { isFree = false } = {}) {
  const cfg = purchaseDisclaimerConfig(event);
  if (!cfg.enabled || !String(cfg.text || "").trim()) return null;
  if (cfg.appliesTo === "paid" && isFree) return null;
  return cfg;
}
