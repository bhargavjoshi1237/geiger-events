
import * as osm from "./osm";

export const PROVIDERS = [osm];

export { geocode } from "./osm";

export function configuredProviders() {
  return PROVIDERS.filter((p) => p.isConfigured());
}
