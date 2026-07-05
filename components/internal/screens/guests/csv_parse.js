// Minimal client-side CSV parser for the Guest Import wizard. Handles quoted
// fields (with embedded commas, quotes, and newlines) and CRLF/LF line endings.
// Returns { headers: string[], rows: string[][] }.

export function parseCsv(text) {
  const src = String(text || "").replace(/^﻿/, ""); // strip BOM
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      // Consume the paired \n of a \r\n sequence.
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  // Flush the trailing cell/row when the file doesn't end in a newline.
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  // Drop fully-empty rows (blank lines).
  const clean = rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  if (!clean.length) return { headers: [], rows: [] };
  const [headers, ...body] = clean;
  return { headers: headers.map((h) => h.trim()), rows: body };
}
