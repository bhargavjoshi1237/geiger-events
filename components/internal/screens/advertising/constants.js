// Lookups, filter options, and formatters for the Advertising area. Config only —
// no row data (records are fetched from lib/supabase/advertising.js). The four ad
// platforms are the shared vocabulary used across Connections, Ad Campaigns,
// Budgets, and Insights.

// --- Platforms ---------------------------------------------------------------
// value → the wrapped ad channel. accent/dotClass drive per-platform styling.
export const AD_PLATFORMS = [
  { value: "google_adsense", label: "Google AdSense", blurb: "Google's display-ad network.", accent: "text-sky-400", dotClass: "bg-sky-400", variant: "info" },
  { value: "facebook_marketplace", label: "Facebook Marketplace", blurb: "Meta Marketplace listings & ads.", accent: "text-blue-400", dotClass: "bg-blue-400", variant: "info" },
  { value: "google_ads", label: "Google Ads", blurb: "Search & display campaigns.", accent: "text-emerald-400", dotClass: "bg-emerald-400", variant: "success" },
  { value: "meta_ads", label: "Meta Ads", blurb: "Facebook + Instagram paid campaigns.", accent: "text-violet-400", dotClass: "bg-violet-400", variant: "purple" },
];

export const PLATFORM_VALUES = AD_PLATFORMS.map((p) => p.value);
export const PLATFORM_OPTIONS = AD_PLATFORMS.map((p) => ({ value: p.value, label: p.label }));
export const PLATFORM_LABEL = Object.fromEntries(AD_PLATFORMS.map((p) => [p.value, p.label]));

// StatusPill-style map so a platform renders as a labelled pill in tables.
export const PLATFORM_MAP = Object.fromEntries(
  AD_PLATFORMS.map((p) => [p.value, { label: p.label, variant: p.variant, dotClass: p.dotClass }]),
);

// --- Status maps (status → StatusPill styling) -------------------------------

export const CAMPAIGN_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Ended: { label: "Ended", variant: "outline", dotClass: "bg-[#525252]" },
};

export const BUDGET_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  Depleted: { label: "Depleted", variant: "danger", dotClass: "bg-red-400" },
};

export const CONNECTION_STATUS_MAP = {
  Connected: { label: "Connected", variant: "success", dotClass: "bg-emerald-400" },
  "Not connected": { label: "Not connected", variant: "neutral", dotClass: "bg-[#737373]" },
};

// --- Option lists ------------------------------------------------------------

export const OBJECTIVE_VALUES = ["Awareness", "Traffic", "Leads", "Sales", "App installs"];
export const BUDGET_PERIOD_VALUES = ["Daily", "Weekly", "Monthly", "Lifetime"];

// --- Formatters --------------------------------------------------------------

export function currency(n) {
  const value = Number(n) || 0;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function compactNumber(n) {
  return (Number(n) || 0).toLocaleString();
}

// Click-through rate from impressions/clicks.
export function ctr(impressions, clicks) {
  const imp = Number(impressions) || 0;
  const clk = Number(clicks) || 0;
  return imp > 0 ? `${((clk / imp) * 100).toFixed(1)}%` : "0.0%";
}
