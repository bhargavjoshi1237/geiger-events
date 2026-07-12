// Lookups, section defaults, and formatters for the Tickets area.
// Config only — never row data.

// --- Formatters --------------------------------------------------------------

export const currency = (n) => `$${Number(n || 0).toLocaleString()}`;

export const formatDate = (iso) => {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// --- Ticket Type record config (ticketing_records.config, module ticket_type)

// A ticket TYPE is a reusable RULE SET (not purchasable). Identity fields
// (name/price/qty/description) live on the event's ticket, not here. Returned by
// a function (not a shared literal) so nested objects aren't shared across records.
export const defaultTicketConfig = () => ({
  minPerOrder: 1,
  maxPerOrder: 0, // 0 = no max
  refund: { refundable: false, cutoffDays: 7, feeHandling: "absorb" },
  sales: { mode: "always", startAt: "", endAt: "" }, // always | window
  visibility: "public", // public | hidden | scheduled
  onSaleAt: "", // scheduled on-sale datetime (visibility === "scheduled")
  accessCode: { enabled: false, code: "" },
  reservedSeating: false,
  questionIds: [], // ordered events.ticket_questions ids asked per attendee
});

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "hidden", label: "Hidden" },
  { value: "scheduled", label: "Scheduled" },
];

// Response types for ticket-based questions (events.ticket_questions.type). The
// public checkout renders each: text/number/email -> Input, textarea -> Textarea,
// select -> dropdown, checkbox -> Checkbox.
export const QUESTION_TYPE_OPTIONS = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Paragraph" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

// --- Ticket Tiers (module "tier") --------------------------------------------

// A reusable level (General, VIP, Platinum) events group their tickets into.
export const defaultTierConfig = () => ({
  rank: 1, // display order; lower shows first
  color: "slate", // accent token (see TIER_COLOR_OPTIONS)
  description: "", // what this tier includes
});

// Accent options for a tier badge — semantic tailwind utilities, never hex.
export const TIER_COLOR_OPTIONS = [
  { value: "slate", label: "Slate", dotClass: "bg-slate-400" },
  { value: "emerald", label: "Emerald", dotClass: "bg-emerald-400" },
  { value: "amber", label: "Amber", dotClass: "bg-amber-400" },
  { value: "violet", label: "Violet", dotClass: "bg-violet-400" },
  { value: "rose", label: "Rose", dotClass: "bg-rose-400" },
];

// --- Bundles (module "bundle") -----------------------------------------------

// Several ticket types sold together. `items` reference ticket_type record ids.
export const defaultBundleConfig = () => ({
  items: [], // [{ ticketTypeId, qty }]
  pricingMode: "fixed", // fixed = one bundle price; sum = total of the items
  price: 0, // used when pricingMode === "fixed"
  description: "",
});

// --- Multi-currency (module "currency") --------------------------------------

// One accepted currency, surfaced at the Stripe payment stage.
export const defaultCurrencyConfig = () => ({
  code: "USD",
  symbol: "$",
  rate: 1, // conversion rate from the base currency
  stripeAccount: "", // Stripe account/id funds settle to
});

// Common presets — picking a code auto-fills its symbol.
export const CURRENCY_PRESETS = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "CAD", symbol: "$" },
  { code: "AUD", symbol: "$" },
  { code: "JPY", symbol: "¥" },
  { code: "INR", symbol: "₹" },
];

// --- Anti-scalping & Resale (module "resale_rule") ---------------------------

// A reusable rule an event opts into to curb scalping and resale.
export const defaultResaleRuleConfig = () => ({
  nameLockRequired: false, // ticket bound to the buyer's name
  transferPolicy: "off", // off | organizer-approval | open
  maxResalePrice: "none", // none | face (cap resale at face value)
  identityCheck: false, // verify ID matches the ticket at entry
  maxPerBuyer: 0, // 0 = no cap
});

export const TRANSFER_POLICY_OPTIONS = [
  { value: "off", label: "No transfers" },
  { value: "organizer-approval", label: "Organizer approval" },
  { value: "open", label: "Open transfers" },
];

// --- Global settings (events.ticketing_settings, one row per project+module) --
// Each factory is the default config for a project-global Tickets feature. The
// screen shows these; individual events override the relevant keys from their
// edit page (stored in the event's own metadata bag).

// Early-bird Sales (module "earlybird").
export const defaultEarlybirdConfig = () => ({
  enabled: false,
  defaultPercent: 15,
  defaultCutoffDays: 14, // days before the event early-bird pricing ends
  stackable: false, // combine with coupons
  note: "",
});

// Donations (module "donation").
export const defaultDonationConfig = () => ({
  enabled: false,
  cause: "",
  suggestedAmounts: [5, 10, 25],
  allowCustom: true,
  minAmount: 1,
});

// Access-code Tickets (module "access_code").
export const defaultAccessCodeConfig = () => ({
  enabled: false,
  promptText: "Have an access code?",
  caseSensitive: false,
});

// Reserved Seating (module "reserved_seating").
export const defaultReservedSeatingConfig = () => ({
  enabled: false,
  allowPickYourSeat: true,
  holdMinutes: 10, // how long a seat is held during checkout
  defaultMapName: "",
});

// Refunds (module "refund").
export const defaultRefundConfig = () => ({
  enabled: true,
  windowDays: 7, // days before the event refunds close
  feeHandling: "absorb", // absorb | deduct processing fees
  autoApprove: false,
  policyText: "",
});

// Payment Plans (module "payment_plan").
export const defaultPaymentPlanConfig = () => ({
  enabled: false,
  installments: 3,
  depositPercent: 20, // taken up front
  cadence: "monthly", // weekly | biweekly | monthly
  lateFee: 0,
});

// Transfers (module "transfer").
export const defaultTransferConfig = () => ({
  enabled: false,
  allowResale: false,
  feeType: "none", // none | flat | percent
  feeAmount: 0,
  deadlineDays: 2, // transfers close this many days before the event
  requireApproval: false,
});

// Group Purchasing (module "group_purchase").
export const defaultGroupPurchaseConfig = () => ({
  enabled: false,
  minSeats: 5,
  defaultDiscountPercent: 10,
  requireApproval: false,
});

// Memberships (module "membership") — master enable + join settings.
export const defaultMembershipConfig = () => ({
  enabled: false,
  publicJoin: false, // let people join from the public page
  autoRenew: true,
  note: "",
});

export const CADENCE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

export const FEE_TYPE_OPTIONS = [
  { value: "none", label: "No fee" },
  { value: "flat", label: "Flat fee" },
  { value: "percent", label: "Percentage" },
];

// Status pill maps for the transactional lists (Refunds, Group Purchasing).
export const REFUND_STATUS_MAP = {
  Requested: { label: "Requested", dotClass: "bg-amber-400" },
  Approved: { label: "Approved", dotClass: "bg-emerald-400" },
  Denied: { label: "Denied", dotClass: "bg-red-400" },
  Refunded: { label: "Refunded", dotClass: "bg-sky-400" },
};

export const GROUP_STATUS_MAP = {
  Pending: { label: "Pending", dotClass: "bg-amber-400" },
  Confirmed: { label: "Confirmed", dotClass: "bg-emerald-400" },
  Cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
};

export const MEMBER_STATUS_MAP = {
  Active: { label: "Active", dotClass: "bg-emerald-400" },
  Expired: { label: "Expired", dotClass: "bg-amber-400" },
  Cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
};

// Membership plan record config (ticketing_records, module "membership").
export const defaultMembershipPlanConfig = () => ({
  price: 0,
  billingPeriod: "yearly", // one-time | monthly | yearly
  benefits: [], // string perks
  discountPercent: 0, // member discount on tickets
  applyToAllEvents: false, // on = discount applies to every event; off = per-event opt-in
  description: "",
});

export const BILLING_PERIOD_OPTIONS = [
  { value: "one-time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];
