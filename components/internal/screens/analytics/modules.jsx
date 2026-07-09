"use client";

import { CalendarClock } from "lucide-react";

import {
  nameCol,
  statusCol,
  textCol,
  count,
  sum,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
} from "@/components/internal/shared/records/builders";

// Analytics modules (backed by events.analytics_records). Only Scheduled Reports
// is a managed record set; the remaining Analytics items are read-only
// dashboards (charts) and are intentionally not modelled as records here.

const REPORT_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
};

const REPORT_TYPES = ["Sales", "Attendance", "Engagement", "Financial"];
const FREQUENCIES = ["Daily", "Weekly", "Monthly"];
const FORMATS = ["PDF", "CSV", "XLSX"];

export const MODULES = {
  report: {
    key: "report",
    title: "Scheduled Reports",
    singular: "Report",
    icon: CalendarClock,
    description: "Automated reports emailed on a schedule — pick the data, cadence, format, and recipients.",
    createLabel: "Add report",
    searchPlaceholder: "Search reports…",
    search: (r) => `${r.name} ${r.config.type || ""}`,
    statusMap: REPORT_STATUS_MAP,
    filters: [
      statusFilter(REPORT_STATUS_MAP),
      configFilter("type", REPORT_TYPES, "All types"),
    ],
    columns: [
      nameCol((r) => r.config.frequency),
      textCol("type", "Type", (r) => r.config.type),
      textCol("recipients", "Recipients", (r) => (r.config.recipients || []).length || ""),
      statusCol(REPORT_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Reports", value: String(records.length), footer: "Scheduled" },
      { label: "Active", value: String(count(records, (r) => r.status === "Active")), footer: "Sending" },
      { label: "Paused", value: String(count(records, (r) => r.status === "Paused")), footer: "On hold" },
      { label: "Recipients", value: String(sum(records, (r) => (r.config.recipients || []).length)), footer: "Across reports" },
    ],
    defaults: {
      status: "Active",
      config: { type: "Sales", frequency: "Weekly", recipients: [], format: "PDF" },
    },
    createFields: [
      nameField("Report name", "e.g. Weekly sales summary"),
      c("type", "Report type", "select", { options: optionsFrom(REPORT_TYPES) }),
      c("frequency", "Frequency", "select", { options: optionsFrom(FREQUENCIES) }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Report",
          fields: [
            nameField("Report name"),
            statusField(REPORT_STATUS_MAP),
            c("type", "Report type", "select", { options: optionsFrom(REPORT_TYPES) }),
            c("frequency", "Frequency", "select", { options: optionsFrom(FREQUENCIES) }),
            c("format", "Format", "select", { options: optionsFrom(FORMATS) }),
          ],
        },
        { title: "Recipients", fields: [c("recipients", "Recipients", "list", { placeholder: "Add an email…" })] },
      ],
    },
  },
};
