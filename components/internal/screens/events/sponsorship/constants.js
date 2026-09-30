// Status pills for the Sponsorship editor sections.

export const FILL_STATUS_MAP = {
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  confirmed: { label: "Confirmed", variant: "success", dotClass: "bg-emerald-400" },
};

export const ENQUIRY_STATUS_MAP = {
  new: { label: "New", variant: "info", dotClass: "bg-sky-400" },
  contacted: { label: "Contacted", variant: "purple", dotClass: "bg-violet-300" },
  converted: { label: "Converted", variant: "success", dotClass: "bg-emerald-400" },
  declined: { label: "Declined", variant: "outline", dotClass: "bg-[#525252]" },
};

export const ENQUIRY_STATUSES = Object.keys(ENQUIRY_STATUS_MAP);
