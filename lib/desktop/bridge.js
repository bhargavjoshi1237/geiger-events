"use client";

// The Electron preload exposes `window.geigerDesktop`; null means a normal browser.
// Contract (desktop/preload.js):
//   isDesktop: true, version: string, platform: string
//   frameless: boolean                         true only in the main window, which draws its own controls
//   openExternal(url) → Promise<boolean>   (https/mailto only)
//   onAuthCallback(cb) → unsubscribe        cb({ tokenHash, type, state, email, error })
//   takePendingAuth() → Promise<payload|null>  a callback that arrived before the page subscribed
//   windowControl(action)                     'minimize' | 'toggle-maximize' | 'close'
//   getWindowState() → Promise<{ maximized, fullscreen, focused }>
//   onWindowState(cb) → unsubscribe           cb({ maximized, fullscreen, focused })
//   startResize(edge) / endResize()           edge ∈ n s e w ne nw se sw; the shell follows the cursor in between
export function getDesktopBridge() {
  if (typeof window === "undefined") return null;
  const bridge = window.geigerDesktop;
  return bridge?.isDesktop ? bridge : null;
}

export function createAuthState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
