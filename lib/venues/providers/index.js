// Provider registry for venue discovery. OpenStreetMap is the only source
// (free, no key). Kept as a registry so the search route stays uniform and a
// second provider could slot in later without touching the route.

import * as osm from "./osm";

export const PROVIDERS = [osm];

export const MERGE_ORDER = ["osm"];

export { geocode } from "./osm";

export function configuredProviders() {
  return PROVIDERS.filter((p) => p.isConfigured());
}
