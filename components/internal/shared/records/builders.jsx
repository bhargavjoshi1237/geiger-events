"use client";

import React from "react";

import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/internal/shared/screen_kit";

// Shared builders for record-manager module configs (see an area's modules.jsx).
// Column/stat/filter/field factories plus small formatters, so every area
// declares its modules the same way.

// --- Formatters & option builders --------------------------------------------

export function currency(n) {
  const value = Number(n) || 0;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function pct(n) {
  return `${Math.round(Number(n) || 0)}%`;
}

// Build a StatusPill map's keys into Select options (no "all" sentinel).
export function statusOptions(map) {
  return Object.keys(map).map((s) => ({ value: s, label: s }));
}

// Build a filter option list from a status map — "all" sentinel first.
export function statusFilterOptions(map, allLabel = "All statuses") {
  return [
    { value: "all", label: allLabel },
    ...Object.keys(map).map((s) => ({ value: s, label: s })),
  ];
}

// Plain option list from string values.
export function optionsFrom(values) {
  return values.map((v) => ({ value: v, label: v }));
}

// --- Columns -----------------------------------------------------------------

export const nameCol = (meta) => ({
  key: "name",
  header: "Name",
  render: (r) => (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-foreground">{r.name || "Untitled"}</span>
      {meta ? (
        <span className="text-xs text-text-secondary">{meta(r) || "—"}</span>
      ) : null}
    </div>
  ),
});
// Name cell with a leading avatar: the record's cover image (headshot/logo) when
// set, otherwise the name's first initial. `shape` picks a round avatar
// (speakers) or a rounded square (logos).
export const avatarNameCol = (meta, { shape = "circle" } = {}) => ({
  key: "name",
  header: "Name",
  render: (r) => {
    const radius = shape === "circle" ? "rounded-full" : "rounded-md";
    const initial = (r.name || "?").trim().charAt(0).toUpperCase() || "?";
    return (
      <div className="flex items-center gap-3">
        {r.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.coverUrl}
            alt=""
            className={cn("h-9 w-9 shrink-0 border border-border object-cover", radius)}
          />
        ) : (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-surface-card text-xs font-semibold text-muted-foreground",
              radius,
            )}
          >
            {initial}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">
            {r.name || "Untitled"}
          </span>
          {meta ? (
            <span className="truncate text-xs text-text-secondary">{meta(r) || "—"}</span>
          ) : null}
        </div>
      </div>
    );
  },
});
export const statusCol = (map) => ({
  key: "status",
  header: "Status",
  render: (r) => <StatusPill status={r.status} map={map} />,
});
export const pillCol = (key, header, get, map) => ({
  key,
  header,
  render: (r) => {
    const v = get(r);
    return v ? (
      <StatusPill status={v} map={map} />
    ) : (
      <span className="text-text-tertiary">—</span>
    );
  },
});
export const textCol = (key, header, get, opts = {}) => ({
  key,
  header,
  align: opts.align,
  className: opts.className,
  render: (r) => {
    const v = get(r);
    return v || v === 0 ? <span>{v}</span> : <span className="text-text-tertiary">—</span>;
  },
});
export const moneyCol = (key, header, get) => ({
  key,
  header,
  align: "right",
  className: "text-right tabular-nums text-muted-foreground",
  render: (r) => currency(get(r)),
});

// --- Stat aggregators --------------------------------------------------------

export const count = (records, fn) => records.filter(fn).length;
export const sum = (records, fn) => records.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
export const distinct = (records, fn) =>
  new Set(
    records.map((r) => (fn(r) || "").toString().trim().toLowerCase()).filter(Boolean),
  ).size;

// --- Filters -----------------------------------------------------------------

export const statusFilter = (map) => ({
  key: "status",
  get: (r) => r.status,
  options: statusFilterOptions(map),
});
export const configFilter = (key, values, allLabel) => ({
  key,
  get: (r) => r.config?.[key],
  options: [{ value: "all", label: allLabel }, ...optionsFrom(values)],
});

// --- Field specs -------------------------------------------------------------

export const nameField = (label = "Name", placeholder) => ({
  key: "name",
  label,
  type: "text",
  scope: "root",
  placeholder,
});
export const statusField = (map) => ({
  key: "status",
  label: "Status",
  type: "select",
  scope: "root",
  options: statusOptions(map),
});
// A config field: c(key, label, type, extra)
export const c = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  scope: "config",
  ...extra,
});
