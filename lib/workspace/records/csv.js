// RFC 4180 CSV: quoted fields may hold commas, quotes ("") and newlines; a leading BOM is ignored.
export function parseCsv(text) {
  const source = String(text).replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === "\"" && source[i + 1] === "\"") { field += "\""; i++; }
      else if (ch === "\"") quoted = false;
      else field += ch;
    } else if (ch === "\"" && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  // Leading =, +, - or @ would run as a formula in spreadsheet apps.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, "\"\"")}"` : safe;
};

export function toCsv(rows) {
  return rows.map((row) => row.map(cell).join(",")).join("\n");
}
