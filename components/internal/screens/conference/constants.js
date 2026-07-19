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

// Speaker Backstage — the green-room readiness of a session before it goes live.
export const BACKSTAGE_STATUS_MAP = {
  "Green room": { label: "Green room", variant: "neutral", dotClass: "bg-[#737373]" },
  "Tech check": { label: "Tech check", variant: "info", dotClass: "bg-sky-400" },
  "Standing by": { label: "Standing by", variant: "warning", dotClass: "bg-amber-400" },
  "On air": { label: "On air", variant: "success", dotClass: "bg-emerald-400" },
  Wrapped: { label: "Wrapped", variant: "outline", dotClass: "bg-[#525252]" },
};

// Livestream Rooms — where a session streams from (on-site or digital).
export const ROOM_STATUS_MAP = {
  Offline: { label: "Offline", variant: "neutral", dotClass: "bg-[#737373]" },
  Scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  Live: { label: "Live", variant: "success", dotClass: "bg-emerald-400" },
  Ended: { label: "Ended", variant: "outline", dotClass: "bg-[#525252]" },
};

export const ROOM_KIND_MAP = {
  Digital: { label: "Digital", variant: "info", dotClass: "bg-sky-400" },
  "On-site": { label: "On-site", variant: "purple", dotClass: "bg-violet-400" },
  Hybrid: { label: "Hybrid", variant: "warning", dotClass: "bg-amber-400" },
};

// Webinar Rooms — a scheduled virtual session with registration and replay.
export const WEBINAR_STATUS_MAP = {
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  Live: { label: "Live", variant: "success", dotClass: "bg-emerald-400" },
  Ended: { label: "Ended", variant: "outline", dotClass: "bg-[#525252]" },
  Cancelled: { label: "Cancelled", variant: "danger", dotClass: "bg-red-400" },
};

// Breakout Rooms — small-group spaces spun up alongside a main session.
export const BREAKOUT_STATUS_MAP = {
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Open: { label: "Open", variant: "success", dotClass: "bg-emerald-400" },
  "In progress": { label: "In progress", variant: "info", dotClass: "bg-sky-400" },
  Full: { label: "Full", variant: "warning", dotClass: "bg-amber-400" },
  Closed: { label: "Closed", variant: "outline", dotClass: "bg-[#525252]" },
};

export const BREAKOUT_KIND_MAP = {
  Discussion: { label: "Discussion", variant: "info", dotClass: "bg-sky-400" },
  Workshop: { label: "Workshop", variant: "purple", dotClass: "bg-violet-400" },
  Networking: { label: "Networking", variant: "success", dotClass: "bg-emerald-400" },
  Roundtable: { label: "Roundtable", variant: "warning", dotClass: "bg-amber-400" },
};

// Sponsor Rooms — a sponsor's branded virtual space (booth / lounge / demo).
export const SPONSOR_ROOM_STATUS_MAP = {
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  Live: { label: "Live", variant: "success", dotClass: "bg-emerald-400" },
  Archived: { label: "Archived", variant: "outline", dotClass: "bg-[#525252]" },
};

export const SPONSOR_ROOM_KIND_MAP = {
  "Virtual booth": { label: "Virtual booth", variant: "info", dotClass: "bg-sky-400" },
  Lounge: { label: "Lounge", variant: "purple", dotClass: "bg-violet-400" },
  "Demo room": { label: "Demo room", variant: "warning", dotClass: "bg-amber-400" },
  "Meeting room": { label: "Meeting room", variant: "success", dotClass: "bg-emerald-400" },
};

// Speaker Portal — how far a speaker is through their self-service submission.
export const PORTAL_STATUS_MAP = {
  "Not started": { label: "Not started", variant: "neutral", dotClass: "bg-[#737373]" },
  "In progress": { label: "In progress", variant: "info", dotClass: "bg-sky-400" },
  Submitted: { label: "Submitted", variant: "warning", dotClass: "bg-amber-400" },
  Approved: { label: "Approved", variant: "success", dotClass: "bg-emerald-400" },
  Overdue: { label: "Overdue", variant: "danger", dotClass: "bg-red-400" },
};

// Simulive & On-demand — pre-recorded content played as-live or on demand.
export const SIMULIVE_STATUS_MAP = {
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  Premiering: { label: "Premiering", variant: "success", dotClass: "bg-emerald-400" },
  Available: { label: "Available", variant: "purple", dotClass: "bg-violet-400" },
  Ended: { label: "Ended", variant: "outline", dotClass: "bg-[#525252]" },
};

export const SIMULIVE_MODE_MAP = {
  Simulive: { label: "Simulive", variant: "purple", dotClass: "bg-violet-400" },
  "On-demand": { label: "On-demand", variant: "info", dotClass: "bg-sky-400" },
  Encore: { label: "Encore", variant: "warning", dotClass: "bg-amber-400" },
};

// Captions & Transcription — the state of a per-session captioning job.
export const CAPTION_STATUS_MAP = {
  Requested: { label: "Requested", variant: "neutral", dotClass: "bg-[#737373]" },
  Scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  Live: { label: "Live", variant: "success", dotClass: "bg-emerald-400" },
  Processing: { label: "Processing", variant: "warning", dotClass: "bg-amber-400" },
  Ready: { label: "Ready", variant: "purple", dotClass: "bg-violet-400" },
  Failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
};

export const CAPTION_MODE_MAP = {
  "Live CART": { label: "Live CART", variant: "success", dotClass: "bg-emerald-400" },
  "AI auto": { label: "AI auto", variant: "info", dotClass: "bg-sky-400" },
  "Post-edited": { label: "Post-edited", variant: "purple", dotClass: "bg-violet-400" },
};

// Assign Agenda — a curated set of sessions assigned to a targeted guest group.
export const AGENDA_ASSIGN_STATUS_MAP = {
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  Published: { label: "Published", variant: "success", dotClass: "bg-emerald-400" },
  Archived: { label: "Archived", variant: "outline", dotClass: "bg-[#525252]" },
};

export const AGENDA_DELIVERY_OPTIONS = ["In-app", "Email", "Push", "Calendar invite"];

// Sponsor / package tier → StatusPill styling (rendered as a pill in tables).
export const TIER_MAP = {
  Platinum: { label: "Platinum", variant: "purple", dotClass: "bg-violet-400" },
  Gold: { label: "Gold", variant: "warning", dotClass: "bg-amber-400" },
  Silver: { label: "Silver", variant: "info", dotClass: "bg-sky-400" },
  Bronze: { label: "Bronze", variant: "neutral", dotClass: "bg-[#a16207]" },
  Community: { label: "Community", variant: "success", dotClass: "bg-emerald-400" },
};
