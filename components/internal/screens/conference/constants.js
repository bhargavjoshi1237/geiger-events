// Lookups, filter options, and formatters for the Conference area. Config only —
// no row data (records are fetched from lib/supabase/conference.js). Every module
// (speaker, sponsor, package, …) gets a status map here; StatusPill renders it.

// --- Status maps (status → StatusPill styling) -------------------------------

export const SPEAKER_STATUS_MAP = {
  Confirmed: { label: "Confirmed", variant: "success", dotClass: "bg-emerald-400" },
  Invited: { label: "Invited", variant: "info", dotClass: "bg-sky-400" },
  Tentative: { label: "Tentative", variant: "warning", dotClass: "bg-amber-400" },
  Declined: { label: "Declined", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const SPONSOR_STATUS_MAP = {
  Confirmed: { label: "Confirmed", variant: "success", dotClass: "bg-emerald-400" },
  Prospect: { label: "Prospect", variant: "info", dotClass: "bg-sky-400" },
  Declined: { label: "Declined", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const PACKAGE_STATUS_MAP = {
  Available: { label: "Available", variant: "success", dotClass: "bg-emerald-400" },
  "Sold out": { label: "Sold out", variant: "warning", dotClass: "bg-amber-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const BOOTH_STATUS_MAP = {
  Available: { label: "Available", variant: "success", dotClass: "bg-emerald-400" },
  Reserved: { label: "Reserved", variant: "info", dotClass: "bg-sky-400" },
  Occupied: { label: "Occupied", variant: "purple", dotClass: "bg-violet-400" },
};

export const VENUE_LEAD_STATUS_MAP = {
  Shortlisted: { label: "Shortlisted", variant: "info", dotClass: "bg-sky-400" },
  Contacted: { label: "Contacted", variant: "purple", dotClass: "bg-violet-400" },
  Quoted: { label: "Quoted", variant: "warning", dotClass: "bg-amber-400" },
  Booked: { label: "Booked", variant: "success", dotClass: "bg-emerald-400" },
  Rejected: { label: "Rejected", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const HOUSING_STATUS_MAP = {
  Available: { label: "Available", variant: "success", dotClass: "bg-emerald-400" },
  Booked: { label: "Booked", variant: "info", dotClass: "bg-sky-400" },
  Full: { label: "Full", variant: "warning", dotClass: "bg-amber-400" },
};

export const PAPER_STATUS_MAP = {
  Submitted: { label: "Submitted", variant: "neutral", dotClass: "bg-[#737373]" },
  "Under review": { label: "Under review", variant: "info", dotClass: "bg-sky-400" },
  Accepted: { label: "Accepted", variant: "success", dotClass: "bg-emerald-400" },
  Waitlisted: { label: "Waitlisted", variant: "warning", dotClass: "bg-amber-400" },
  Rejected: { label: "Rejected", variant: "danger", dotClass: "bg-red-400" },
};

export const CERTIFICATE_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Archived: { label: "Archived", variant: "outline", dotClass: "bg-[#525252]" },
};

export const SESSION_STATUS_MAP = {
  Scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  Live: { label: "Live", variant: "success", dotClass: "bg-emerald-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Cancelled: { label: "Cancelled", variant: "danger", dotClass: "bg-red-400" },
};

export const RECORDING_STATUS_MAP = {
  Published: { label: "Published", variant: "success", dotClass: "bg-emerald-400" },
  Processing: { label: "Processing", variant: "warning", dotClass: "bg-amber-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
};

// Sponsor / package tier → StatusPill styling (rendered as a pill in tables).
export const TIER_MAP = {
  Platinum: { label: "Platinum", variant: "purple", dotClass: "bg-violet-400" },
  Gold: { label: "Gold", variant: "warning", dotClass: "bg-amber-400" },
  Silver: { label: "Silver", variant: "info", dotClass: "bg-sky-400" },
  Bronze: { label: "Bronze", variant: "neutral", dotClass: "bg-[#a16207]" },
  Community: { label: "Community", variant: "success", dotClass: "bg-emerald-400" },
};
