// Parse and validate pasted / uploaded badge lists before they reach smart_badge_import(). Pure.

import { normalizeBadgeUid } from "./uid";

const UID_HEADERS = ["uid", "nfc_uid", "chip_uid", "chip", "rfid_id", "rfid", "nfc", "tag_id", "tag_uid", "badge_uid"];
const SERIAL_HEADERS = ["serial", "serial_number", "serial_no", "badge_number", "badge_no", "number", "badge_serial"];
const EMAIL_HEADERS = ["email", "e-mail", "email_address"];
const CODE_HEADERS = ["ticket_code", "ticketcode", "code", "pass_code"];
const NAME_HEADERS = ["name", "attendee", "attendee_name", "full_name"];

const clean = (v) => String(v ?? "").trim().replace(/^"(.*)"$/, "$1").trim();
const headerKey = (v) => clean(v).toLowerCase().replace(/\s+/g, "_");

function splitLine(line, delimiter) {
  // Quoted CSV cells may contain the delimiter.
  const out = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cell);
      cell = "";
    } else cell += ch;
  }
  out.push(cell);
  return out.map(clean);
}

function pickDelimiter(line) {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

const findIdx = (header, names) => header.findIndex((h) => names.includes(h));

// Text -> [{ line, uid, serial, email, code, name }]. Accepts a bare UID per line, "serial,uid" pairs,
// or a CSV with a header row. A lone badge_id column is a UID (the RFID / NFC import's convention);
// next to a uid column it's the printed serial.
export function parseBadgeList(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const delimiter = pickDelimiter(lines[0]);
  const first = splitLine(lines[0], delimiter).map(headerKey);
  const known = [...UID_HEADERS, ...SERIAL_HEADERS, ...EMAIL_HEADERS, ...CODE_HEADERS, ...NAME_HEADERS, "badge_id"];
  const hasHeader = first.some((h) => known.includes(h));

  if (hasHeader) {
    let uidIdx = findIdx(first, UID_HEADERS);
    let serialIdx = findIdx(first, SERIAL_HEADERS);
    const badgeIdIdx = first.indexOf("badge_id");
    if (badgeIdIdx >= 0) {
      if (uidIdx < 0) uidIdx = badgeIdIdx;
      else if (serialIdx < 0) serialIdx = badgeIdIdx;
    }
    const emailIdx = findIdx(first, EMAIL_HEADERS);
    const codeIdx = findIdx(first, CODE_HEADERS);
    const nameIdx = findIdx(first, NAME_HEADERS);
    return lines.slice(1).map((line, i) => {
      const cols = splitLine(line, delimiter);
      const at = (idx) => (idx >= 0 ? cols[idx] || "" : "");
      return {
        line: i + 2,
        uid: normalizeBadgeUid(at(uidIdx)),
        serial: at(serialIdx),
        email: at(emailIdx).toLowerCase(),
        code: at(codeIdx).toUpperCase(),
        name: at(nameIdx),
      };
    });
  }

  return lines.map((line, i) => {
    const cols = splitLine(line, delimiter).filter(Boolean);
    const [a = "", b = ""] = cols;
    return cols.length >= 2
      ? { line: i + 1, uid: normalizeBadgeUid(b), serial: a, email: "", code: "", name: "" }
      : { line: i + 1, uid: normalizeBadgeUid(a), serial: "", email: "", code: "", name: "" };
  });
}

// Classify every row against itself and the event's existing badges.
// kinds: create | attach (serial exists without a UID) | duplicate (in this list) | uid_exists | serial_exists | empty
export function validateBadgeRows(rows, existingBadges = []) {
  const byUid = new Map();
  const bySerial = new Map();
  for (const b of existingBadges || []) {
    const key = normalizeBadgeUid(b.uid);
    if (key) byUid.set(key, b);
    if (b.serial) bySerial.set(String(b.serial).trim(), b);
  }
  const seenUid = new Set();
  const seenSerial = new Set();
  const out = (rows || []).map((row) => {
    const uid = normalizeBadgeUid(row.uid);
    const serial = String(row.serial || "").trim();
    let kind = "create";
    if (!uid && !serial) kind = "empty";
    else if ((uid && seenUid.has(uid)) || (serial && seenSerial.has(serial))) kind = "duplicate";
    else if (uid && byUid.has(uid)) kind = "uid_exists";
    else if (serial && bySerial.has(serial)) {
      kind = uid && !bySerial.get(serial).uid ? "attach" : "serial_exists";
    }
    if (uid) seenUid.add(uid);
    if (serial) seenSerial.add(serial);
    return { ...row, uid, serial, kind };
  });
  const count = (k) => out.filter((r) => r.kind === k).length;
  return {
    rows: out,
    ready: out.filter((r) => r.kind === "create" || r.kind === "attach"),
    summary: {
      create: count("create"),
      attach: count("attach"),
      duplicate: count("duplicate"),
      existing: count("uid_exists") + count("serial_exists"),
      empty: count("empty"),
    },
  };
}

export const SKIP_REASON_LABELS = {
  EMPTY: "empty row",
  DUPLICATE_UID: "UID already issued",
  DUPLICATE_SERIAL: "serial already issued",
};
