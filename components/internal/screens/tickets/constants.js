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

// --- Ticket Types record config (ticketing_records.config, module ticket_type)

// A fresh default config for a new reusable ticket. Returned by a function (not
// a shared literal) so nested objects aren't shared across records.
export const defaultTicketConfig = () => ({
  price: 0, // face value; 0 = free
  qty: 0, // capacity; 0 = unlimited
  description: "", // buyer-facing blurb
  minPerOrder: 1,
  maxPerOrder: 0, // 0 = no max
  refund: { refundable: false, cutoffDays: 7, feeHandling: "absorb" },
  sales: { mode: "always", startAt: "", endAt: "" }, // always | window
  visibility: "public", // public | hidden | scheduled
  onSaleAt: "", // scheduled on-sale datetime (visibility === "scheduled")
  accessCode: { enabled: false, code: "" },
  reservedSeating: false,
});

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "hidden", label: "Hidden" },
  { value: "scheduled", label: "Scheduled" },
];
