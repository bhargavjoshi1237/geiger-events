// Lookups, filter options, and formatters for the Venues area. Config only —
// no row data (venues are fetched from lib/supabase/venues.js). Mirrors the
// shape of the events area's constants.

import {
  Wifi,
  SquareParking,
  Accessibility,
  UtensilsCrossed,
  Volume2,
  Theater,
  Wine,
  Snowflake,
  Trees,
} from "lucide-react";

// Status → StatusPill styling.
export const VENUE_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Inactive: { label: "Inactive", variant: "neutral", dotClass: "bg-[#737373]" },
  Archived: { label: "Archived", variant: "outline", dotClass: "bg-[#525252]" },
};

// Type → Badge styling.
export const VENUE_TYPE_MAP = {
  Indoor: { label: "Indoor", variant: "neutral" },
  Outdoor: { label: "Outdoor", variant: "success" },
  Hybrid: { label: "Hybrid", variant: "purple" },
  Virtual: { label: "Virtual", variant: "info" },
};

// Filter option lists — "all" sentinel first.
export const VENUE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.keys(VENUE_STATUS_MAP).map((s) => ({ value: s, label: s })),
];

export const VENUE_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  ...Object.keys(VENUE_TYPE_MAP).map((t) => ({ value: t, label: t })),
];

// Select options for the editor (no "all" sentinel).
export const VENUE_TYPE_OPTIONS = Object.keys(VENUE_TYPE_MAP).map((t) => ({
  value: t,
  label: t,
}));

export const VENUE_STATUS_OPTIONS = Object.keys(VENUE_STATUS_MAP).map((s) => ({
  value: s,
  label: s,
}));

export const VENUE_TIMEZONES = [
  { value: "Europe/London", label: "London (GMT+1)" },
  { value: "America/New_York", label: "New York (GMT-4)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-7)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+2)" },
  { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
];

// Amenity catalog. `key` is what persists in the venue's amenities array.
export const AMENITIES = [
  { key: "wifi", label: "Wi-Fi", icon: Wifi },
  { key: "parking", label: "Parking", icon: SquareParking },
  { key: "accessible", label: "Wheelchair accessible", icon: Accessibility },
  { key: "catering", label: "Catering", icon: UtensilsCrossed },
  { key: "av", label: "AV / Sound", icon: Volume2 },
  { key: "stage", label: "Stage", icon: Theater },
  { key: "bar", label: "Bar", icon: Wine },
  { key: "aircon", label: "Air conditioning", icon: Snowflake },
  { key: "outdoor", label: "Outdoor space", icon: Trees },
];

export const AMENITY_LABEL = Object.fromEntries(
  AMENITIES.map((a) => [a.key, a.label]),
);

// The capacity we surface as "capacity" in tables/stats — the larger of the two.
export function venueCapacity(v) {
  return Math.max(Number(v?.seatedCapacity) || 0, Number(v?.standingCapacity) || 0);
}

// One-line location summary (city + region/country) for list/meta rows.
export function venueLocation(v) {
  return [v?.city, v?.region || v?.country].filter(Boolean).join(", ");
}

// Full, human-readable address (street → country). Used when attaching a venue
// to an event so the event's single `address` field is geocoder-friendly.
export function venueFullAddress(v) {
  return [v?.address, v?.city, v?.region, v?.postcode, v?.country]
    .filter(Boolean)
    .join(", ");
}
