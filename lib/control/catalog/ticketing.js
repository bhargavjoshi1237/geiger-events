import { defaultCouponConfig } from "../../events/discount_rules.js";
import { defaultEntitlements } from "../../memberships/entitlements.js";
import { activeField, c, nameField, options } from "./builders.js";

// Ticketing-kit records (events.ticketing_records, and events.campaign_assets for Campaigns), ported from each screen's edit sections.
// These rows switch on and off instead of carrying a status. A field's `forKinds` limits it to the kinds whose edit form shows it.
// Nested config the phone can't edit sensibly (rule builders, item lists, schedules) is left out; updates merge, so it survives.

const TICKETS = "components/internal/screens/tickets";
const DATETIME_LOCAL = { placeholder: "YYYY-MM-DDTHH:MM", hint: "Local time, e.g. 2026-12-01T19:00." };
const BLANK_IS_NONE = (what) => ({ min: 0, hint: `Leave blank for ${what}.` });

const base = (props) => ({ store: "ticketing", defaults: { active: true, config: {} }, ...props });

export const TICKETING_MODULES = [
  base({
    id: "ticketing.ticket_type",
    module: "ticket_type",
    section: "tickets",
    title: "Ticket Types",
    singular: "Ticket type",
    icon: "ticket",
    description: "Reusable rule sets — refund policy, sales window, visibility, and questions. Apply one to an event's tickets from the event editor.",
    createLabel: "Add ticket type",
    kinds: [
      {
        value: "ticket",
        label: "Ticket",
        config: {
          minPerOrder: 1,
          maxPerOrder: 0,
          refund: { refundable: false, cutoffDays: 7, feeHandling: "absorb" },
          sales: { mode: "always", startAt: "", endAt: "" },
          visibility: "public",
          onSaleAt: "",
          accessCode: { enabled: false, code: "" },
          reservedSeating: false,
          questionIds: [],
        },
      },
    ],
    summary: ["visibility"],
    create: ["name"],
    panels: [
      { title: "Ticket type", fields: [nameField("Name", "e.g. Standard admission"), activeField()] },
      {
        title: "Order limits",
        fields: [
          c("minPerOrder", "Min per order", "number", { min: 0 }),
          c("maxPerOrder", "Max per order", "number", { min: 0, hint: "0 means no maximum." }),
        ],
      },
      {
        title: "Visibility & access",
        fields: [
          c("visibility", "Visibility", "select", { options: options([{ value: "public", label: "Public" }, { value: "hidden", label: "Hidden" }, { value: "scheduled", label: "Scheduled" }]) }),
          c("onSaleAt", "On sale from", "text", { ...DATETIME_LOCAL, hint: "Used when visibility is Scheduled." }),
          c("reservedSeating", "Reserved seating", "switch", { hint: "Buyers pick a seat from a map instead of general admission." }),
        ],
      },
      { title: "Refund policy", fields: [c("refund", "Refund policy", "readonly", { hint: "Refund rules are edited on the dashboard." })] },
    ],
    source: `${TICKETS}/ticket_types.jsx`,
  }),
  base({
    id: "ticketing.tier",
    module: "tier",
    section: "tickets",
    title: "Ticket Tiers",
    singular: "Tier",
    icon: "layers",
    description: "Reusable ticket levels. Create a tier here, then group an event's tickets into it from the event's edit page.",
    createLabel: "Add tier",
    kinds: [{ value: "tier", label: "Tier", config: { rank: 1, color: "slate", description: "" } }],
    summary: ["rank"],
    create: ["name"],
    panels: [
      { title: "Tier", fields: [nameField("Name", "e.g. VIP"), activeField()] },
      {
        title: "Ordering & accent",
        fields: [
          c("rank", "Rank", "number", { min: 1, hint: "Lower ranks show first." }),
          c("color", "Accent", "select", {
            options: options([
              { value: "slate", label: "Slate" },
              { value: "emerald", label: "Emerald" },
              { value: "amber", label: "Amber" },
              { value: "violet", label: "Violet" },
              { value: "rose", label: "Rose" },
            ]),
          }),
        ],
      },
      { title: "What buyers see", fields: [c("description", "Description", "textarea", { placeholder: "What this tier includes" })] },
    ],
    source: `${TICKETS}/ticket_tiers.jsx`,
  }),
  base({
    id: "ticketing.discount",
    module: "discount",
    section: "tickets",
    title: "Discounts & Codes",
    singular: "Discount",
    icon: "percent",
    description: "Reusable coupons and discount rules. Create them here, then attach to any event from its edit page.",
    createLabel: "Add discount",
    kinds: [
      { value: "coupon", label: "Coupon", config: defaultCouponConfig() },
      { value: "group", label: "Group rule", config: { mode: "automatic", minQty: 5, percent: 10, code: "" } },
      { value: "earlybird", label: "Early-bird rule", config: { until: "", percent: 15 } },
      { value: "affiliate", label: "Affiliate code", config: { code: "", partner: "", commission: 0 } },
    ],
    summary: ["code", "percent"],
    create: ["name"],
    panels: [
      { title: "Discount", fields: [nameField("Name", "e.g. Spring sale"), activeField()] },
      {
        title: "Code",
        fields: [
          c("code", "Code", "text", { placeholder: "e.g. SPRING25", forKinds: ["coupon", "group", "affiliate"] }),
          c("discountType", "Base discount", "select", {
            options: options([{ value: "percent", label: "% off" }, { value: "flat", label: "Amount off" }]),
            forKinds: ["coupon"],
          }),
          c("value", "Amount", "number", { min: 0, hint: "A percentage, or an amount for an amount-off code.", forKinds: ["coupon"] }),
          c("applyPer", "Flat amount applies", "select", {
            options: options([{ value: "order", label: "Once per order" }, { value: "ticket", label: "Per ticket" }]),
            forKinds: ["coupon"],
          }),
          c("usageLimit", "Usage limit", "number", { min: 0, hint: "0 means unlimited.", forKinds: ["coupon"] }),
          c("maxDiscount", "Max discount", "number", { ...BLANK_IS_NONE("no cap"), forKinds: ["coupon"] }),
          c("mode", "Discount mode", "select", {
            options: options([{ value: "automatic", label: "Automatic" }, { value: "manual", label: "Manual code" }]),
            forKinds: ["group"],
          }),
          c("percent", "Discount (%)", "number", { min: 0, max: 100, forKinds: ["group", "earlybird"] }),
          c("until", "Available until", "date", { forKinds: ["earlybird"] }),
          c("partner", "Partner name", "text", { forKinds: ["affiliate"] }),
          c("commission", "Commission (%)", "number", { min: 0, max: 100, hint: "Paid to the partner per sale.", forKinds: ["affiliate"] }),
        ],
      },
      {
        title: "Eligibility",
        fields: [
          c("minQty", "Min. tickets", "number", { ...BLANK_IS_NONE("any quantity"), forKinds: ["coupon", "group"] }),
          c("maxQty", "Max. tickets", "number", { ...BLANK_IS_NONE("no upper bound"), forKinds: ["coupon"] }),
          c("validFrom", "Valid from", "text", { ...DATETIME_LOCAL, forKinds: ["coupon"] }),
          c("validUntil", "Valid until", "text", { ...DATETIME_LOCAL, forKinds: ["coupon"] }),
          c("rules", "Discount rules", "readonly", { hint: "Quantity and date rules are edited on the dashboard.", forKinds: ["coupon"] }),
        ],
      },
    ],
    source: `${TICKETS}/discounts.jsx`,
  }),
  base({
    id: "ticketing.bundle",
    module: "bundle",
    section: "tickets",
    title: "Bundles",
    singular: "Bundle",
    icon: "package",
    description: "Reusable bundles — several tickets sold together at one price. Create one here, then attach it to any event.",
    createLabel: "Add bundle",
    kinds: [{ value: "bundle", label: "Bundle", config: { items: [], pricingMode: "fixed", price: 0, description: "" } }],
    summary: ["price"],
    create: ["name"],
    panels: [
      { title: "Bundle", fields: [nameField("Name", "e.g. Weekend pass"), activeField()] },
      {
        title: "Pricing",
        fields: [
          c("pricingMode", "Pricing mode", "select", { options: options([{ value: "fixed", label: "Fixed price" }, { value: "sum", label: "Sum of items" }]) }),
          c("price", "Bundle price", "number", { min: 0, hint: "Used when the pricing mode is Fixed price." }),
          c("items", "Tickets in the bundle", "readonly", { hint: "Choose the bundled tickets on the dashboard." }),
        ],
      },
      { title: "Description", fields: [c("description", "Description", "textarea")] },
    ],
    source: `${TICKETS}/bundles.jsx`,
  }),
  base({
    id: "ticketing.pricing_rule",
    module: "pricing_rule",
    section: "tickets",
    title: "Dynamic Pricing",
    singular: "Pricing rule",
    icon: "trending-up",
    description: "Reusable pricing rules — by sell-through, by date, or by how many tickets a buyer takes. Create one here, then attach it to any event.",
    createLabel: "Add pricing rule",
    kinds: [
      { value: "demand", label: "Sell-through rule", config: { threshold: 75, bump: 10, floor: null, ceiling: null } },
      {
        value: "time",
        label: "Date & time rule",
        config: { trigger: "days_before", daysBefore: 14, at: "", direction: "decrease", adjustment: "percent", value: 15, floor: null, ceiling: null },
      },
      {
        value: "quantity",
        label: "Quantity rule",
        config: { minQty: 4, applyPer: "ticket", direction: "decrease", adjustment: "flat", value: 5, floor: null, ceiling: null },
      },
      { value: "resale", label: "Resale rule", config: { maxPricePercent: 100, transferCap: 2 } },
    ],
    summary: ["value"],
    create: ["name"],
    panels: [
      { title: "Rule", fields: [nameField("Name", "e.g. Final-week drop"), activeField()] },
      {
        title: "When it applies",
        fields: [
          c("threshold", "Trigger at (% sold)", "number", { min: 0, max: 100, forKinds: ["demand"] }),
          c("trigger", "Arms", "select", {
            options: options([{ value: "days_before", label: "Days before the event" }, { value: "on_date", label: "On a fixed date" }]),
            forKinds: ["time"],
          }),
          c("daysBefore", "Days before the event", "number", { min: 0, forKinds: ["time"] }),
          c("at", "Date & time", "text", { ...DATETIME_LOCAL, forKinds: ["time"] }),
          c("minQty", "Minimum tickets", "number", { min: 1, forKinds: ["quantity"] }),
          c("applyPer", "Applies", "select", {
            options: options([{ value: "ticket", label: "Per ticket" }, { value: "order", label: "Once per order" }]),
            forKinds: ["quantity"],
          }),
        ],
      },
      {
        title: "Price change",
        fields: [
          c("bump", "Raise price by (%)", "number", { min: 0, forKinds: ["demand"] }),
          c("direction", "Direction", "select", {
            options: options([{ value: "increase", label: "Raise price" }, { value: "decrease", label: "Lower price" }]),
            forKinds: ["time", "quantity"],
          }),
          c("adjustment", "Adjust by", "select", {
            options: options([{ value: "percent", label: "Percent of price" }, { value: "flat", label: "Flat amount" }]),
            forKinds: ["time", "quantity"],
          }),
          c("value", "Amount", "number", { min: 0, hint: "A percentage or a flat amount, per Adjust by.", forKinds: ["time", "quantity"] }),
          c("maxPricePercent", "Max resale price (% of face)", "number", { min: 0, forKinds: ["resale"] }),
          c("transferCap", "Transfers per ticket", "number", { min: 0, forKinds: ["resale"] }),
        ],
      },
      {
        title: "Guardrails",
        fields: [
          c("floor", "Price floor", "number", { ...BLANK_IS_NONE("no floor"), forKinds: ["demand", "time", "quantity"] }),
          c("ceiling", "Price ceiling", "number", { ...BLANK_IS_NONE("no ceiling"), forKinds: ["demand", "time", "quantity"] }),
        ],
      },
    ],
    source: `${TICKETS}/dynamic_pricing.jsx`,
  }),
  base({
    id: "ticketing.resale_rule",
    module: "resale_rule",
    section: "tickets",
    title: "Anti-scalping & Resale",
    singular: "Resale rule",
    icon: "shield-check",
    description: "Reusable rules that curb scalping and control resale. Create one here, then enable it on any event.",
    createLabel: "Add rule",
    kinds: [
      {
        value: "resale_rule",
        label: "Resale rule",
        config: { nameLockRequired: false, transferPolicy: "off", maxResalePrice: "none", identityCheck: false, maxPerBuyer: 0 },
      },
    ],
    summary: ["transferPolicy"],
    create: ["name"],
    panels: [
      { title: "Rule", fields: [nameField("Name", "e.g. Face-value resale"), activeField()] },
      {
        title: "Identity",
        fields: [
          c("nameLockRequired", "Require name lock", "switch", { hint: "Each ticket is tied to the buyer's name." }),
          c("identityCheck", "ID check at entry", "switch", { hint: "Staff verify a matching ID when admitting the holder." }),
        ],
      },
      {
        title: "Transfers & resale",
        fields: [
          c("transferPolicy", "Transfer policy", "select", {
            options: options([
              { value: "off", label: "No transfers" },
              { value: "organizer-approval", label: "Organizer approval" },
              { value: "open", label: "Open transfers" },
            ]),
          }),
          c("maxResalePrice", "Resale price cap", "select", { options: options([{ value: "none", label: "No cap" }, { value: "face", label: "Face value" }]) }),
          c("maxPerBuyer", "Max per buyer", "number", { min: 0, hint: "0 means no cap." }),
        ],
      },
    ],
    source: `${TICKETS}/anti_scalping.jsx`,
  }),
  base({
    id: "ticketing.currency",
    module: "currency",
    // Bank and payout details: changing them redirects money, so it needs the settings key, not just the Tickets view.
    permission: "events.settings.manage",
    section: "tickets",
    title: "Multi-currency",
    singular: "Currency",
    icon: "coins",
    description: "Reusable currencies buyers can pay in. Add one here, then it's offered at the Stripe payment stage.",
    createLabel: "Add currency",
    kinds: [{ value: "currency", label: "Currency", config: { code: "USD", symbol: "$", rate: 1, stripeAccount: "" } }],
    summary: ["code"],
    create: ["name", "code"],
    panels: [
      { title: "Currency", fields: [nameField("Name", "e.g. Euro"), activeField()] },
      {
        title: "Pricing",
        fields: [
          c("code", "Code", "select", { options: options(["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"]) }),
          c("symbol", "Symbol", "text", { max: 8 }),
          c("rate", "Rate", "number", { min: 0, hint: "Conversion from your base currency." }),
          c("stripeAccount", "Stripe account", "text", { placeholder: "acct_…" }),
        ],
      },
    ],
    source: `${TICKETS}/multi_currency.jsx`,
  }),
  base({
    id: "ticketing.payment_method",
    module: "payment_method",
    // Bank and payout details: changing them redirects money, so it needs the settings key, not just the Tickets view.
    permission: "events.settings.manage",
    section: "tickets",
    title: "Payments & Methods",
    singular: "Payment method",
    icon: "credit-card",
    description: "Reusable ways buyers can pay. Create a method here, then attach it to any event.",
    createLabel: "Add method",
    kinds: [
      { value: "stripe", label: "Stripe", config: { currency: "usd", statementDescriptor: "", supportEmail: "" } },
      { value: "paypal", label: "PayPal", config: { email: "" } },
      { value: "bank", label: "Bank transfer", config: { accountName: "", accountNumber: "", reference: "" } },
    ],
    summary: ["currency"],
    create: ["name"],
    panels: [
      { title: "Method", fields: [nameField("Name", "e.g. Card payments"), activeField()] },
      {
        title: "Details",
        fields: [
          c("currency", "Currency", "select", {
            options: options([
              { value: "usd", label: "USD — US Dollar" },
              { value: "eur", label: "EUR — Euro" },
              { value: "gbp", label: "GBP — British Pound" },
              { value: "cad", label: "CAD — Canadian Dollar" },
              { value: "aud", label: "AUD — Australian Dollar" },
            ]),
            forKinds: ["stripe"],
          }),
          c("supportEmail", "Support email", "email", { hint: "Shown on receipts.", forKinds: ["stripe"] }),
          c("statementDescriptor", "Statement descriptor", "text", { max: 22, hint: "Up to 22 characters, shown on the buyer's card statement.", forKinds: ["stripe"] }),
          c("email", "PayPal email", "email", { forKinds: ["paypal"] }),
          c("accountName", "Account name", "text", { forKinds: ["bank"] }),
          c("accountNumber", "Account number / IBAN", "text", { forKinds: ["bank"] }),
          c("reference", "Payment reference", "text", { hint: "What buyers put as the reference.", forKinds: ["bank"] }),
        ],
      },
    ],
    source: `${TICKETS}/payment_methods.jsx`,
  }),
  base({
    id: "ticketing.payout",
    module: "payout",
    // Bank and payout details: changing them redirects money, so it needs the settings key, not just the Tickets view.
    permission: "events.settings.manage",
    section: "tickets",
    title: "Payouts",
    singular: "Payout account",
    icon: "banknote",
    description: "Reusable payout accounts — where ticket revenue lands, and when. Attach one to an event.",
    createLabel: "Add payout account",
    kinds: [{ value: "account", label: "Payout account", config: { method: "stripe", schedule: "weekly", feesTo: "organizer", account: "" } }],
    summary: ["method", "schedule"],
    create: ["name"],
    panels: [
      { title: "Account", fields: [nameField("Name", "e.g. Main account"), activeField()] },
      {
        title: "Payout",
        fields: [
          c("method", "Method", "select", { options: options([{ value: "stripe", label: "Stripe" }, { value: "bank", label: "Bank transfer" }, { value: "paypal", label: "PayPal" }]) }),
          c("schedule", "Schedule", "select", { options: options([{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "on-request", label: "On request" }]) }),
          c("account", "Account", "text", { hint: "The account, IBAN or PayPal email funds go to." }),
          c("feesTo", "Who pays the fee", "select", { options: options([{ value: "organizer", label: "Absorb fees" }, { value: "buyer", label: "Pass to buyer" }]) }),
        ],
      },
    ],
    source: `${TICKETS}/payouts.jsx`,
  }),
  base({
    id: "ticketing.invoice_profile",
    module: "invoice_profile",
    // Bank and payout details: changing them redirects money, so it needs the settings key, not just the Tickets view.
    permission: "events.settings.manage",
    section: "tickets",
    title: "Invoices & Receipts",
    singular: "Invoice profile",
    icon: "file-text",
    description: "Reusable invoice and receipt profiles. Attach one to an event to control its tax documents.",
    createLabel: "Add invoice profile",
    kinds: [{ value: "profile", label: "Invoice profile", config: { generation: "manual", businessId: "", prefix: "INV", receiptFooter: "" } }],
    summary: ["prefix"],
    create: ["name"],
    panels: [
      { title: "Profile", fields: [nameField("Name", "e.g. Standard invoices"), activeField()] },
      {
        title: "Invoices",
        fields: [
          c("generation", "Generation", "select", { options: options([{ value: "manual", label: "Manual" }, { value: "auto", label: "Automatic" }]) }),
          c("prefix", "Invoice prefix", "text", { hint: "Leads the invoice number." }),
          c("businessId", "Business / VAT ID", "text", { hint: "Printed on every invoice." }),
        ],
      },
      { title: "Receipts", fields: [c("receiptFooter", "Receipt footer", "textarea")] },
    ],
    source: `${TICKETS}/invoice_profiles.jsx`,
  }),
  base({
    id: "ticketing.order_policy",
    module: "order_policy",
    section: "tickets",
    title: "Order Policies",
    singular: "Order policy",
    icon: "shopping-bag",
    description: "Reusable order policies — refunds, transfers, and self-service — that you attach to events.",
    createLabel: "Add policy",
    kinds: [
      {
        value: "policy",
        label: "Order policy",
        config: { selfService: true, refundPolicy: "partial", refundApproval: "manual", refundWindowDays: 7, allowNameChange: true, allowTicketTransfer: false },
      },
    ],
    summary: ["refundPolicy"],
    create: ["name"],
    panels: [
      { title: "Policy", fields: [nameField("Name", "e.g. Flexible refunds"), activeField()] },
      {
        title: "Refunds",
        fields: [
          c("refundPolicy", "Refund policy", "select", { options: options([{ value: "none", label: "No refunds" }, { value: "partial", label: "Partial" }, { value: "full", label: "Full" }]) }),
          c("refundWindowDays", "Request window (days)", "number", { min: 0 }),
          c("refundApproval", "Approval", "select", { options: options([{ value: "auto", label: "Automatic" }, { value: "manual", label: "Manual review" }]) }),
        ],
      },
      {
        title: "Buyer self-service",
        fields: [
          c("selfService", "Let buyers manage their order", "switch", { hint: "Update details and download tickets from their confirmation link." }),
          c("allowNameChange", "Allow name changes", "switch"),
          c("allowTicketTransfer", "Allow ticket transfer", "switch"),
        ],
      },
    ],
    source: `${TICKETS}/orders_attendees.jsx`,
  }),
  base({
    id: "ticketing.membership",
    module: "membership",
    section: "memberships",
    title: "Membership Plans",
    singular: "Plan",
    icon: "badge-check",
    description: "Reusable membership tiers. Create a plan here, then attach it to events for special pricing and access.",
    createLabel: "Add plan",
    kinds: [
      {
        value: "membership",
        label: "Membership",
        config: {
          price: 0,
          billingPeriod: "yearly",
          benefits: [],
          discountPercent: 0,
          applyToAllEvents: false,
          description: "",
          posterUrl: "",
          entitlements: defaultEntitlements(),
        },
      },
    ],
    summary: ["price", "billingPeriod"],
    create: ["name"],
    panels: [
      { title: "Plan", fields: [nameField("Name", "e.g. Annual member"), activeField()] },
      {
        title: "Pricing",
        fields: [
          c("price", "Price", "number", { min: 0 }),
          c("billingPeriod", "Billing", "select", { options: options([{ value: "one-time", label: "One-time" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]) }),
          c("discountPercent", "Member discount (%)", "number", { min: 0, max: 100 }),
          c("applyToAllEvents", "Apply to all events", "switch", { hint: "On applies the discount everywhere; off is per-event." }),
        ],
      },
      {
        title: "What members see",
        fields: [
          c("description", "Summary", "textarea", { hint: "Shown to prospective members." }),
          c("benefits", "Perks", "list", { placeholder: "Add a perk…", hint: "Shown on the plan card in the members portal." }),
          c("posterUrl", "Poster image", "url", { hint: "A link to the plan's poster background." }),
        ],
      },
    ],
    source: "components/internal/screens/memberships/membership_plans.jsx",
  }),
  {
    id: "campaigns.sequence",
    store: "campaigns",
    module: "sequence",
    section: "campaigns",
    title: "Drip Sequences",
    singular: "Sequence",
    icon: "workflow",
    description: "Automated multi-step message flows. Build a sequence once, then enrol contacts on a trigger.",
    createLabel: "Add sequence",
    kinds: [
      {
        value: "sequence",
        label: "Sequence",
        config: { trigger: "registration", steps: [{ id: "s1", channel: "email", delayDays: 0, subject: "", body: "" }] },
      },
    ],
    defaults: { active: true, config: {} },
    summary: ["trigger"],
    create: ["name", "trigger"],
    panels: [
      { title: "Sequence", fields: [nameField("Name", "e.g. Welcome series"), activeField()] },
      {
        title: "Enrolment",
        fields: [
          c("trigger", "Trigger", "select", {
            options: options([
              { value: "registration", label: "On registration" },
              { value: "rsvp", label: "On RSVP" },
              { value: "date", label: "Relative to event date" },
              { value: "manual", label: "Manual enrolment" },
            ]),
          }),
          c("steps", "Steps", "readonly", { hint: "Steps and their messages are built on the dashboard." }),
        ],
      },
    ],
    source: "components/internal/screens/campaigns/drip_sequences.jsx",
  },
  {
    id: "campaigns.template",
    store: "campaigns",
    module: "template",
    section: "campaigns",
    title: "Email Templates",
    singular: "Template",
    icon: "mail",
    description: "Reusable email templates. Build one here, then load it into any email campaign from its Content section.",
    createLabel: "Add template",
    kinds: [{ value: "template", label: "Template", config: { subject: "", previewText: "", body: "", category: "general" } }],
    defaults: { active: true, config: {} },
    summary: ["category"],
    create: ["name"],
    panels: [
      { title: "Template", fields: [nameField("Name", "e.g. Event reminder"), activeField()] },
      {
        title: "Message",
        fields: [
          c("subject", "Subject", "text"),
          c("category", "Category", "select", {
            options: options([
              { value: "general", label: "General" },
              { value: "invite", label: "Invite" },
              { value: "reminder", label: "Reminder" },
              { value: "receipt", label: "Receipt" },
              { value: "announcement", label: "Announcement" },
            ]),
          }),
          c("previewText", "Preview text", "text", { hint: "Shown after the subject in most inboxes." }),
          c("body", "Body", "textarea"),
        ],
      },
    ],
    source: "components/internal/screens/campaigns/email_template_builder.jsx",
  },
];
