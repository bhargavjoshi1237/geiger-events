// This device's stable identity for the check-in device registry, plus id helpers that work outside a secure context.

export const CHECKIN_APP_VERSION = "checkin-offline/1";

const DEVICE_KEY = "checkin:device-id";
let memoryDeviceId = null;

export function newClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = newClientId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    memoryDeviceId ||= newClientId();
    return memoryDeviceId;
  }
}

// "3F2A-91C0" — what staff read off the banner to match a device in the dashboard.
export function shortDeviceId(id) {
  const hex = String(id || "").replace(/-/g, "").toUpperCase();
  return hex ? `${hex.slice(0, 4)}-${hex.slice(4, 8)}` : "";
}

// A short, human description of the browser for the device list ("iPhone · Safari").
export function deviceAgent() {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent || "";
  const platform = /iPad/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /CriOS|Chrome\//.test(ua)
        ? "Chrome"
        : /FxiOS|Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  return `${platform} · ${browser}`;
}
