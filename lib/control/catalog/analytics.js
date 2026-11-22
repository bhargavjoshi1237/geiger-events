import { c, nameField, options, statusField, statuses } from "./builders.js";

// Analytics records (events.analytics_records), ported from components/internal/screens/analytics/modules.jsx.
// Only Scheduled Reports is a record set; the other Analytics screens are read-only dashboards.

export const ANALYTICS_MODULES = [
  {
    id: "analytics.report",
    store: "analytics",
    module: "report",
    section: "analytics",
    title: "Scheduled Reports",
    singular: "Report",
    icon: "calendar-clock",
    description: "Automated reports emailed on a schedule — pick the data, cadence, format, and recipients.",
    createLabel: "Add report",
    statuses: statuses({ Active: { variant: "success" }, Paused: { variant: "warning" }, Draft: { variant: "neutral" } }),
    defaults: { status: "Active", config: { type: "Sales", frequency: "Weekly", recipients: [], format: "PDF" } },
    summary: ["type", "frequency"],
    create: ["name", "type", "frequency"],
    panels: [
      {
        title: "Report",
        fields: [
          nameField("Report name", "e.g. Weekly sales summary"),
          statusField(),
          c("type", "Report type", "select", { options: options(["Sales", "Attendance", "Engagement", "Financial"]) }),
          c("frequency", "Frequency", "select", { options: options(["Daily", "Weekly", "Monthly"]) }),
          c("format", "Format", "select", { options: options(["PDF", "CSV", "XLSX"]) }),
        ],
      },
      { title: "Recipients", fields: [c("recipients", "Recipients", "list", { placeholder: "Add an email…" })] },
    ],
    source: "components/internal/screens/analytics/modules.jsx",
  },
];
