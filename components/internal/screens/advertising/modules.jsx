"use client";

import { Megaphone, Wallet } from "lucide-react";

import {
  nameCol,
  statusCol,
  pillCol,
  textCol,
  moneyCol,
  count,
  sum,
  statusFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
  currency,
} from "@/components/internal/shared/records/builders";
import {
  PLATFORM_OPTIONS,
  PLATFORM_LABEL,
  PLATFORM_MAP,
  CAMPAIGN_STATUS_MAP,
  BUDGET_STATUS_MAP,
  OBJECTIVE_VALUES,
  BUDGET_PERIOD_VALUES,
  ctr,
} from "./constants";

// The two record-backed Advertising modules, declared for the shared kit
// (records_kit.jsx). Both are backed by events.advertising_records, discriminated
// by `key`. Connections and Insights are bespoke (they aren't record lists), so
// they live in their own files — not here.

// Platform filter (labelled options, "all" sentinel first).
const platformFilter = {
  key: "platform",
  get: (r) => r.config?.platform,
  options: [{ value: "all", label: "All platforms" }, ...PLATFORM_OPTIONS],
};

export const MODULES = {
  // ------------------------------------------------------------ Ad Campaigns ---
  campaign: {
    key: "campaign",
    title: "Ad Campaigns",
    singular: "campaign",
    icon: Megaphone,
    description:
      "Run and track paid campaigns across your connected ad platforms — objective, spend, and performance in one place.",
    createLabel: "New campaign",
    searchPlaceholder: "Search campaigns, objectives…",
    search: (r) =>
      `${r.name} ${r.config.objective || ""} ${PLATFORM_LABEL[r.config.platform] || ""}`,
    statusMap: CAMPAIGN_STATUS_MAP,
    filters: [statusFilter(CAMPAIGN_STATUS_MAP), platformFilter],
    columns: [
      nameCol((r) =>
        [PLATFORM_LABEL[r.config.platform], r.config.objective].filter(Boolean).join(" · "),
      ),
      pillCol("platform", "Platform", (r) => r.config.platform, PLATFORM_MAP),
      statusCol(CAMPAIGN_STATUS_MAP),
      textCol("clicks", "Clicks", (r) => (Number(r.config.clicks) || 0).toLocaleString(), { align: "right", className: "text-right tabular-nums text-muted-foreground" }),
      moneyCol("spend", "Spend", (r) => r.config.spend),
    ],
    stats: (records) => {
      const impressions = sum(records, (r) => r.config.impressions);
      const clicks = sum(records, (r) => r.config.clicks);
      return [
        { label: "Campaigns", value: String(records.length), footer: "All statuses" },
        { label: "Active", value: String(count(records, (r) => r.status === "Active")), footer: "Live now" },
        { label: "Total spend", value: currency(sum(records, (r) => r.config.spend)), footer: "Across campaigns" },
        { label: "Avg CTR", value: ctr(impressions, clicks), footer: "Clicks / impressions" },
      ];
    },
    defaults: {
      status: "Draft",
      config: { platform: "google_ads", objective: "Traffic", spend: 0, impressions: 0, clicks: 0, conversions: 0, startDate: "", endDate: "", notes: "" },
    },
    createFields: [
      nameField("Campaign name", "e.g. Summer Festival — Awareness"),
      c("platform", "Platform", "select", { options: PLATFORM_OPTIONS }),
      c("objective", "Objective", "select", { options: optionsFrom(OBJECTIVE_VALUES) }),
      statusField(CAMPAIGN_STATUS_MAP),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Campaign",
          fields: [
            nameField("Campaign name"),
            statusField(CAMPAIGN_STATUS_MAP),
            c("platform", "Platform", "select", { options: PLATFORM_OPTIONS }),
            c("objective", "Objective", "select", { options: optionsFrom(OBJECTIVE_VALUES) }),
            c("startDate", "Start date", "text", { placeholder: "e.g. 2026-07-01" }),
            c("endDate", "End date", "text", { placeholder: "e.g. 2026-07-31" }),
          ],
        },
        {
          title: "Performance",
          description: "The numbers a live platform sync would fill; editable here for now.",
          fields: [
            c("spend", "Spend", "number", { placeholder: "e.g. 1200" }),
            c("impressions", "Impressions", "number", { placeholder: "e.g. 45000" }),
            c("clicks", "Clicks", "number", { placeholder: "e.g. 1800" }),
            c("conversions", "Conversions", "number", { placeholder: "e.g. 120" }),
          ],
        },
        { title: "Notes", fields: [c("notes", "Notes", "textarea", { placeholder: "Targeting, creative direction, learnings…" })] },
      ],
    },
  },

  // ----------------------------------------------------------------- Budgets ---
  budget: {
    key: "budget",
    title: "Budgets",
    singular: "budget",
    icon: Wallet,
    description:
      "Set spend limits and pacing per platform or campaign, and watch how much of each is already spent.",
    createLabel: "New budget",
    searchPlaceholder: "Search budgets, campaigns…",
    search: (r) =>
      `${r.name} ${r.config.campaign || ""} ${PLATFORM_LABEL[r.config.platform] || ""}`,
    statusMap: BUDGET_STATUS_MAP,
    filters: [statusFilter(BUDGET_STATUS_MAP), platformFilter],
    columns: [
      nameCol((r) =>
        [PLATFORM_LABEL[r.config.platform], r.config.period].filter(Boolean).join(" · "),
      ),
      pillCol("platform", "Platform", (r) => r.config.platform, PLATFORM_MAP),
      moneyCol("amount", "Budget", (r) => r.config.amount),
      moneyCol("spent", "Spent", (r) => r.config.spent),
      statusCol(BUDGET_STATUS_MAP),
    ],
    stats: (records) => {
      const amount = sum(records, (r) => r.config.amount);
      const spent = sum(records, (r) => r.config.spent);
      return [
        { label: "Budgets", value: String(records.length), footer: "All statuses" },
        { label: "Total budget", value: currency(amount), footer: "Allocated" },
        { label: "Spent", value: currency(spent), footer: "So far" },
        { label: "Remaining", value: currency(Math.max(0, amount - spent)), footer: "Left to spend" },
      ];
    },
    defaults: {
      status: "Active",
      config: { platform: "google_ads", campaign: "", amount: 0, spent: 0, period: "Monthly", notes: "" },
    },
    createFields: [
      nameField("Budget name", "e.g. July — Google Ads"),
      c("platform", "Platform", "select", { options: PLATFORM_OPTIONS }),
      c("amount", "Amount", "number", { placeholder: "e.g. 2000" }),
      statusField(BUDGET_STATUS_MAP),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Budget",
          fields: [
            nameField("Budget name"),
            statusField(BUDGET_STATUS_MAP),
            c("platform", "Platform", "select", { options: PLATFORM_OPTIONS }),
            c("campaign", "Campaign", "text", { placeholder: "Which campaign this caps (optional)" }),
            c("amount", "Amount", "number", { placeholder: "e.g. 2000" }),
            c("spent", "Spent", "number", { placeholder: "e.g. 850" }),
            c("period", "Period", "select", { options: optionsFrom(BUDGET_PERIOD_VALUES) }),
          ],
        },
        { title: "Notes", fields: [c("notes", "Notes", "textarea", { placeholder: "Pacing rules, cap reasoning…" })] },
      ],
    },
  },
};

export const MODULE_LIST = Object.values(MODULES);
