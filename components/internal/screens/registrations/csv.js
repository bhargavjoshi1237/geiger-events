// Minimal client-side CSV export. Builds a CSV string from an array of header
// keys + rows and triggers a browser download. Used by the RSVPs and Dietary &
// Accessibility screens for catering/venue ops handoffs.

function escapeCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  // Quote when the cell contains a comma, quote, or newline; double inner quotes.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// columns: [{ header, value(row) }]. filename: e.g. "registrations.csv".
export function downloadCsv(columns, rows, filename) {
  if (typeof window === "undefined") return;
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.value(row))).join(","))
    .join("\n");
  const csv = `${head}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
