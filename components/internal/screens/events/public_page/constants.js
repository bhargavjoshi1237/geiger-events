import { MapPin, Video, Globe } from "lucide-react";

import { AMENITIES } from "@/components/internal/screens/venues/constants";
import { TIER_COLOR_OPTIONS } from "@/components/internal/screens/tickets/constants";

export const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export const TYPE_ICON = { "In-person": MapPin, Online: Video, Hybrid: Globe };

export const typeIconFor = (type) => TYPE_ICON[type] || MapPin;

export const AMENITY_ICON = Object.fromEntries(
  AMENITIES.map((a) => [a.key, a.icon]),
);

export const tierAccentDot = (color) =>
  TIER_COLOR_OPTIONS.find((c) => c.value === color)?.dotClass ||
  TIER_COLOR_OPTIONS[0].dotClass;
