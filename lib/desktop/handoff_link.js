import { DEEP_LINK_SCHEME } from "./config.js";

// The mobile app starts its browser sign-in with a "mobile_" state, so the same handoff (and dash's next= allowlist) can return to it.
export const MOBILE_STATE_PREFIX = "mobile_";
export const MOBILE_RETURN = "geigerevents://team-auth";

export function handoffDeepLink(handoff) {
  const query = handoff.error
    ? { error: handoff.error, state: handoff.state }
    : { token_hash: handoff.tokenHash, type: handoff.type, state: handoff.state, email: handoff.email };
  const base = handoff.state.startsWith(MOBILE_STATE_PREFIX) ? MOBILE_RETURN : `${DEEP_LINK_SCHEME}://auth`;
  return `${base}?${new URLSearchParams(query).toString()}`;
}
