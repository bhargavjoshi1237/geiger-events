// Chip UID + printed serial helpers for Smart Badges. Pure: no I/O, safe on server and client.

// Match key for a chip UID — mirrors events.nfc_uid_key(): uppercase alphanumerics only.
export const normalizeBadgeUid = (value) =>
  String(value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");

// Web NFC reports serialNumber as "04:a2:1f:9c"; readers send "04A21F9C". Same key either way.
export const webNfcSerialToUid = (serialNumber) => normalizeBadgeUid(serialNumber);

// Keyboard-wedge readers often type the UID as a decimal number (and sometimes byte-reversed).
export const READER_FORMATS = [
  { value: "hex", label: "Hex (as typed)" },
  { value: "dec", label: "Decimal → hex" },
  { value: "dec_rev", label: "Decimal → hex, reversed bytes" },
];

export function readerValueToUid(raw, format = "hex") {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (format === "hex" || !/^\d+$/.test(text)) return normalizeBadgeUid(text);
  let hex;
  try {
    hex = BigInt(text).toString(16).toUpperCase();
  } catch {
    return normalizeBadgeUid(text);
  }
  if (hex.length % 2) hex = `0${hex}`;
  while (hex.length < 8) hex = `00${hex}`;
  if (format === "dec_rev") hex = (hex.match(/../g) || []).reverse().join("");
  return hex;
}

// Short hex-ish chip ids are 4/7/10 bytes; anything alphanumeric of 4+ chars is accepted for test tags.
export const isPlausibleUid = (uid) => /^[0-9A-Z]{4,32}$/.test(normalizeBadgeUid(uid));

export function serialAt(prefix, start, digits, index) {
  const n = (Number(start) || 0) + index;
  return `${prefix || ""}${String(n).padStart(Math.max(0, Number(digits) || 0), "0")}`;
}

export function serialRange({ prefix = "", start = 1, digits = 4, count = 0 }) {
  const total = Math.max(0, Math.min(10000, Math.floor(Number(count) || 0)));
  return Array.from({ length: total }, (_, i) => serialAt(prefix, start, digits, i));
}

// Natural sort for serials so BADGE-2 comes before BADGE-10.
export const compareSerial = (a, b) =>
  String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
