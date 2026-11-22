import { c } from "./builders.js";

// Tickets, Orders and Memberships settings for Control (rows of events.ticketing_settings), ported from the
// settings_kit screens. Defaults mirror each screen's default*Config; lists of numbers or codes stay on the dashboard.

const TICKETS = "components/internal/screens/tickets";

const enabled = (label, hint) => c("enabled", label, "switch", { hint });
const note = (placeholder) => c("note", "Note", "textarea", { hint: "Optional context shown to your team.", placeholder });

export const TICKETING_SETTINGS = [
  {
    id: "ticketing.access_code",
    store: "ticketing",
    key: "access_code",
    section: "tickets",
    title: "Access-code Tickets",
    icon: "key-round",
    description: "Hidden tickets unlocked with a code on the event page.",
    defaults: { enabled: false, promptText: "Have an access code?", caseSensitive: false },
    panels: [
      {
        title: "Access codes",
        fields: [
          enabled("Enable access-code tickets", "Allow hidden tickets unlocked by a code."),
          c("caseSensitive", "Case-sensitive codes", "switch", { hint: "Require the exact letter case." }),
          c("promptText", "Prompt text", "text", { placeholder: "Have an access code?" }),
        ],
      },
    ],
    source: `${TICKETS}/access_codes.jsx`,
  },
  {
    id: "ticketing.donation",
    store: "ticketing",
    key: "donation",
    section: "tickets",
    title: "Donations",
    icon: "heart",
    description: "A donation prompt during checkout; events can take over the cause and amounts.",
    defaults: { enabled: false, cause: "", suggestedAmounts: [5, 10, 25], allowCustom: true, minAmount: 1 },
    panels: [
      {
        title: "Donations",
        fields: [
          enabled("Enable donations", "Show a donation prompt during checkout."),
          c("allowCustom", "Allow custom amount", "switch", { hint: "Let buyers enter their own amount." }),
        ],
      },
      {
        title: "Cause",
        fields: [
          c("cause", "Cause", "text", { placeholder: "e.g. Community scholarship fund", hint: "What donations support." }),
          c("suggestedAmounts", "Suggested amounts", "readonly", { hint: "Edit the amount list on the dashboard." }),
          c("minAmount", "Minimum", "number", { min: 0, hint: "Smallest donation accepted." }),
          c("description", "Description", "textarea", { placeholder: "Tell buyers how their donation helps." }),
        ],
      },
    ],
    source: `${TICKETS}/donations.jsx`,
  },
  {
    id: "ticketing.earlybird",
    store: "ticketing",
    key: "earlybird",
    section: "tickets",
    title: "Early-bird Sales",
    icon: "timer",
    description: "Project-wide early-bird pricing; events tune the discount on their edit page.",
    defaults: { enabled: false, defaultPercent: 15, defaultCutoffDays: 14, stackable: false, note: "" },
    panels: [
      {
        title: "Early-bird",
        fields: [
          enabled("Enable early-bird sales", "Offer early-bird pricing across this project's events."),
          c("stackable", "Stack with coupons", "switch", { hint: "Let buyers combine early-bird pricing with a coupon." }),
        ],
      },
      {
        title: "Defaults",
        fields: [
          c("defaultPercent", "Default discount (%)", "number", { min: 0, max: 100 }),
          c("defaultCutoffDays", "Ends before event (days)", "number", { min: 0, hint: "Days before the event early-bird pricing closes." }),
          note("e.g. Early-bird runs for the first two weeks after announcement."),
        ],
      },
    ],
    source: `${TICKETS}/earlybird.jsx`,
  },
  {
    id: "ticketing.group_purchase",
    store: "ticketing",
    key: "group_purchase",
    section: "tickets",
    title: "Group Purchasing",
    icon: "users",
    description: "Group and bulk orders across your events.",
    defaults: { enabled: false, minSeats: 5, defaultDiscountPercent: 10, requireApproval: false },
    panels: [
      {
        title: "Group purchasing",
        fields: [
          enabled("Enable group purchasing", "Offer bulk/group orders across this project's events."),
          c("requireApproval", "Require approval", "switch", { hint: "Review each group order before it's confirmed." }),
        ],
      },
      {
        title: "Defaults",
        fields: [
          c("minSeats", "Minimum seats", "number", { min: 0, hint: "Smallest order that counts as a group." }),
          c("defaultDiscountPercent", "Group discount (%)", "number", { min: 0, max: 100 }),
        ],
      },
    ],
    source: `${TICKETS}/group_purchasing.jsx`,
  },
  {
    id: "ticketing.payment_plan",
    store: "ticketing",
    key: "payment_plan",
    section: "tickets",
    title: "Payment Plans",
    icon: "calendar-sync",
    description: "Let buyers pay in installments; events choose whether to offer it.",
    defaults: { enabled: false, installments: 3, depositPercent: 20, cadence: "monthly", lateFee: 0 },
    panels: [
      { title: "Payment plans", fields: [enabled("Enable payment plans", "Offer installment payments at checkout.")] },
      {
        title: "Plan terms",
        fields: [
          c("installments", "Installments", "number", { min: 1, hint: "Number of payments after the deposit." }),
          c("depositPercent", "Deposit (%)", "number", { min: 0, max: 100, hint: "Taken up front at checkout." }),
          c("cadence", "Cadence", "select", {
            options: [
              { value: "weekly", label: "Weekly" },
              { value: "biweekly", label: "Every 2 weeks" },
              { value: "monthly", label: "Monthly" },
            ],
          }),
          c("lateFee", "Late fee", "number", { min: 0, hint: "Charged on a missed installment. 0 = none." }),
        ],
      },
    ],
    source: `${TICKETS}/payment_plans.jsx`,
  },
  {
    id: "ticketing.refund",
    store: "ticketing",
    key: "refund",
    section: "tickets",
    title: "Refunds",
    icon: "rotate-ccw",
    description: "Your project's refund policy for buyer refund requests.",
    defaults: { enabled: true, windowDays: 7, feeHandling: "absorb", autoApprove: false, policyText: "" },
    panels: [
      {
        title: "Refunds",
        fields: [
          enabled("Allow refunds", "Let buyers request a refund before the cutoff."),
          c("autoApprove", "Auto-approve requests", "switch", { hint: "Approve requests automatically instead of reviewing each." }),
        ],
      },
      {
        title: "Policy",
        fields: [
          c("windowDays", "Refund window (days)", "number", { min: 0, hint: "Days before the event refunds close." }),
          c("feeHandling", "Processing fees", "select", {
            options: [
              { value: "absorb", label: "Refund in full" },
              { value: "deduct", label: "Keep processing fees" },
            ],
          }),
          c("policyText", "Policy text", "textarea", { hint: "Shown to buyers on the event page.", placeholder: "e.g. Full refunds up to 7 days before the event." }),
        ],
      },
    ],
    source: `${TICKETS}/refunds.jsx`,
  },
  {
    id: "ticketing.release",
    store: "ticketing",
    key: "release",
    section: "tickets",
    title: "Batched Releases",
    icon: "layers",
    description: "Ticket waves; events split their tickets into waves on their edit page.",
    defaults: { enabled: false, defaultQty: 100, defaultDelayDays: 0, note: "" },
    panels: [
      { title: "Batched releases", fields: [enabled("Enable batched releases", "Let events split tickets into waves.")] },
      {
        title: "Defaults",
        fields: [
          c("defaultQty", "Default tranche size", "number", { min: 0, hint: "Suggested tickets per wave." }),
          c("defaultDelayDays", "Default sell-out delay (days)", "number", { min: 0, hint: "Days after a sell-out the next wave opens (0 = immediately)." }),
          note("e.g. Flagship shows go in three waves."),
        ],
      },
    ],
    source: `${TICKETS}/releases.jsx`,
  },
  {
    id: "ticketing.reserved_seating",
    store: "ticketing",
    key: "reserved_seating",
    section: "tickets",
    title: "Reserved Seating",
    icon: "ticket",
    description: "Seat-map selection for your events; toggle it per event on its edit page.",
    defaults: { enabled: false, allowPickYourSeat: true, holdMinutes: 10, defaultMapName: "" },
    panels: [
      {
        title: "Reserved seating",
        fields: [
          enabled("Enable reserved seating", "Allow seat-map selection for this project's events."),
          c("allowPickYourSeat", "Pick-your-seat", "switch", { hint: "Let buyers choose their own seat from the map." }),
        ],
      },
      {
        title: "Defaults",
        fields: [
          c("holdMinutes", "Seat hold (minutes)", "number", { min: 0, hint: "Minutes a seat is held during checkout." }),
          c("defaultMapName", "Default seat map", "text", { placeholder: "e.g. Main hall", hint: "Name of the map events start from." }),
        ],
      },
    ],
    source: `${TICKETS}/reserved_seating.jsx`,
  },
  {
    id: "ticketing.transfer",
    store: "ticketing",
    key: "transfer",
    section: "tickets",
    title: "Transfers",
    icon: "arrow-left-right",
    description: "How buyers transfer or resell tickets; events choose whether to allow it.",
    defaults: { enabled: false, allowResale: false, feeType: "none", feeAmount: 0, deadlineDays: 2, requireApproval: false },
    panels: [
      {
        title: "Transfers",
        fields: [
          enabled("Enable transfers", "Allow buyers to reassign a ticket to a new holder."),
          c("allowResale", "Allow resale", "switch", { hint: "Permit reselling a ticket, not just gifting it." }),
          c("requireApproval", "Require approval", "switch", { hint: "Approve each transfer before it takes effect." }),
        ],
      },
      {
        title: "Fees and deadline",
        fields: [
          c("feeType", "Transfer fee", "select", {
            options: [
              { value: "none", label: "No fee" },
              { value: "flat", label: "Flat fee" },
              { value: "percent", label: "Percentage" },
            ],
          }),
          c("feeAmount", "Fee amount", "number", { min: 0, hint: "A flat amount, or a percentage when the fee is a percentage." }),
          c("deadlineDays", "Transfer deadline (days)", "number", { min: 0, hint: "Transfers close this many days before the event." }),
        ],
      },
    ],
    source: `${TICKETS}/transfers.jsx`,
  },
  {
    id: "ticketing.orders",
    store: "ticketing",
    key: "orders",
    section: "orders",
    title: "Order Settings",
    icon: "receipt",
    description: "Project-wide defaults for order references, refunds and receipts.",
    defaults: {
      orderPrefix: "ORD",
      refundReasonCodes: ["duplicate", "requested_by_customer", "event_cancelled", "fraudulent", "other"],
      refundMethods: ["original", "credit", "manual"],
      receiptFooter: "Thanks for your order! Reply to this email if you need a hand.",
      defaultRefundPolicy: "partial",
    },
    panels: [
      {
        title: "Order numbering",
        fields: [
          c("orderPrefix", "Order prefix", "text", { placeholder: "ORD", hint: "Use capitals; it starts every order reference." }),
          c("defaultRefundPolicy", "Default refund policy", "select", {
            options: [
              { value: "none", label: "No refunds" },
              { value: "partial", label: "Partial" },
              { value: "full", label: "Full" },
            ],
          }),
        ],
      },
      {
        title: "Refunds",
        fields: [
          c("refundReasonCodes", "Refund reasons", "readonly", { hint: "Choose which reason codes staff can pick on the dashboard." }),
          c("refundMethods", "Refund methods", "readonly", { hint: "Choose how refunds can be paid back on the dashboard." }),
        ],
      },
      {
        title: "Receipt footer",
        fields: [c("receiptFooter", "Footer text", "textarea", { placeholder: "e.g. Thanks for your order!", hint: "Shown at the bottom of every receipt." })],
      },
    ],
    source: "components/internal/screens/orders/order_settings.jsx",
  },
  {
    id: "ticketing.membership",
    store: "ticketing",
    key: "membership",
    section: "memberships",
    title: "Membership Settings",
    icon: "award",
    description: "Turn memberships on and set how they renew and how people join.",
    defaults: { enabled: false, publicJoin: false, autoRenew: true, note: "" },
    panels: [
      {
        title: "Memberships",
        fields: [
          enabled("Enable memberships", "Turn on the Memberships section for this project."),
          c("publicJoin", "Public join", "switch", { hint: "Let people buy a membership from your public pages and the members portal." }),
          c("autoRenew", "Auto-renew", "switch", { hint: "Renew memberships at the end of each period." }),
        ],
      },
      { title: "Note", fields: [c("note", "Internal note", "textarea", { hint: "Optional context for your team.", placeholder: "e.g. Members get 10% off all tickets." })] },
    ],
    source: "components/internal/screens/memberships/membership_settings.jsx",
  },
];
