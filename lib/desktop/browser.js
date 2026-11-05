// The system-browser side of the desktop app: opening suite pages and tracking a browser sign-in.
import { AUTH_STATE_KEY, AUTH_STATE_TTL_MS } from "./config";
import { getDesktopBridge } from "./bridge";

// Resolves false when the shell refused or failed to open the URL.
export async function openInBrowser(url) {
  const bridge = getDesktopBridge();
  if (!bridge) {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
  try {
    return Boolean(await bridge.openExternal(url));
  } catch {
    return false;
  }
}

export function rememberAuthState(state) {
  try {
    window.localStorage.setItem(AUTH_STATE_KEY, JSON.stringify({ state, createdAt: Date.now() }));
  } catch {
    // Without storage the callback can't be matched; the app reports that when it arrives.
  }
}

export function forgetAuthState() {
  try {
    window.localStorage.removeItem(AUTH_STATE_KEY);
  } catch {
    // Nothing stored to clear.
  }
}

// Reads and clears the stored state: "ok" for a fresh exact match, "missing" when no sign-in was started, else "rejected".
export function consumeAuthState(state) {
  let stored = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(AUTH_STATE_KEY) || "null");
  } catch {
    stored = null;
  }
  forgetAuthState();
  if (!stored?.state) return "missing";
  const age = Date.now() - Number(stored.createdAt);
  if (!(age >= 0 && age <= AUTH_STATE_TTL_MS)) return "rejected";
  return state && state === stored.state ? "ok" : "rejected";
}
