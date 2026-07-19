// Provider registry for Housing & Travel discovery. OpenStreetMap is the only
// source (free, no key). Kept as a registry so the search route stays uniform
// and a keyed provider (rates/availability) could slot in later untouched.

import * as osm from "./osm";

export const PROVIDERS = [osm];

export { geocode } from "./osm";

export function configuredProviders() {
  return PROVIDERS.filter((p) => p.isConfigured());
}
