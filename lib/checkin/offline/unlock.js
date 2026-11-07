// Lets a staff route unlock with no connection: a code that unlocked this event online is remembered as a hash with its role.
// Only codes already used on this device work offline; the device already holds the guest list, so this adds no new exposure.

const MAX_CODES = 5;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const storageKey = (eventId, type) => `checkin:unlock:${eventId}:${type || "any"}`;

async function digest(text) {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function read(eventId, type) {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey(eventId, type)) || "[]");
    return Array.isArray(list) ? list.filter((x) => x?.h && Date.now() - (x.at || 0) < MAX_AGE_MS) : [];
  } catch {
    return [];
  }
}

export async function rememberUnlock(eventId, type, code, role) {
  const h = await digest(`${eventId}:${type || "any"}:${code}`);
  if (!h) return;
  const next = [{ h, role, at: Date.now() }, ...read(eventId, type).filter((x) => x.h !== h)].slice(0, MAX_CODES);
  try {
    localStorage.setItem(storageKey(eventId, type), JSON.stringify(next));
  } catch {
  }
}

// The remembered role for this code, or null.
export async function matchUnlock(eventId, type, code) {
  const h = await digest(`${eventId}:${type || "any"}:${code}`);
  if (!h) return null;
  return read(eventId, type).find((x) => x.h === h)?.role || null;
}

// A code the server now rejects is dropped so it can't keep unlocking offline.
export async function forgetUnlock(eventId, type, code) {
  const h = await digest(`${eventId}:${type || "any"}:${code}`);
  if (!h) return;
  try {
    localStorage.setItem(storageKey(eventId, type), JSON.stringify(read(eventId, type).filter((x) => x.h !== h)));
  } catch {
  }
}
