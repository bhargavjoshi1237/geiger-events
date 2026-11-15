import { toCsv } from "@/lib/workspace/records/csv.js";
import { valueText } from "../state/format";

// CSV of the given records: number, title, status, then each visible field (links as their labels).
export function recordsToCsv(object, fields, rows, timeZone) {
  const statuses = new Map((object.statuses ?? []).map((status) => [status.key, status.label]));
  const header = ["Number", "Title", ...(object.statuses?.length ? ["Status"] : []), ...fields.map((field) => field.name)];
  const body = rows.map((row) => [
    `${object.numberPrefix}-${row.number}`,
    row.title ?? "",
    ...(object.statuses?.length ? [statuses.get(row.status) ?? ""] : []),
    ...fields.map((field) => {
      if (field.type === "link_record" || field.type === "link_event") return (row.links?.[field.id] ?? []).map((link) => link.label).join("; ");
      return valueText(field, row.values?.[field.id], { timeZone, computed: ["lookup", "rollup"].includes(field.type) ? row.computed?.[field.id] : undefined });
    }),
  ]);
  return toCsv([header, ...body]);
}

export function downloadText(name, text, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSafe = (text) => String(text).replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "export";
