// Shared constants for the desktop app's sign-in, org picker and browser→app handoff.

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Browser sign-in always runs on the suite (dash login), even when the app points at a dev server.
export const SUITE_ORIGIN = process.env.NEXT_PUBLIC_SUITE_ORIGIN || "https://geiger.studio";

export const DEEP_LINK_SCHEME = "geiger-events";

// Where the suite serves the handoff; dash login's `next=` allowlist matches this exact path.
export const HANDOFF_PATH = "/events/desktop/handoff";

export const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export const AUTH_STATE_KEY = "geiger-desktop:auth-state";
export const LAST_ORG_KEY = "geiger-desktop:last-org";

// A browser sign-in the user hasn't finished within this window is abandoned.
export const AUTH_STATE_TTL_MS = 15 * 60 * 1000;

export const OAUTH_PROVIDERS = ["google", "github"];

export function suiteUrl(path = "/") {
  return `${SUITE_ORIGIN}${path}`;
}

export function handoffPathWithState(state) {
  return `${HANDOFF_PATH}?state=${encodeURIComponent(state)}`;
}

// Opened in the system browser: signs in on the suite (if needed), then hands the session to the app.
export function handoffUrl(state) {
  return suiteUrl(handoffPathWithState(state));
}

// Dash login that returns to the handoff; `provider` auto-starts Google/GitHub on the dash side.
export function browserLoginUrl(state, provider) {
  const params = new URLSearchParams({ next: handoffPathWithState(state) });
  if (provider && OAUTH_PROVIDERS.includes(provider)) params.set("provider", provider);
  return suiteUrl(`/login?${params.toString()}`);
}

// Enterprise SSO starts from the email domain; discover redirects into the org's provider.
export function ssoUrl(state, email) {
  const params = new URLSearchParams({ email, next: handoffPathWithState(state) });
  return suiteUrl(`/api/oauth/discover?${params.toString()}`);
}

export function desktopPath(query = "") {
  return `${BASE_PATH}/desktop${query}`;
}

export function projectPath(projectId) {
  return `${BASE_PATH}/project/${projectId}`;
}
