import { c, nameField, options, statusField, statuses } from "./builders.js";

// Advertising records (events.advertising_records), ported from components/internal/screens/advertising/modules.jsx.
// Platforms and statuses mirror advertising/constants.js; Connections and Insights are bespoke screens, not records.

const SOURCE = "components/internal/screens/advertising/modules.jsx";
const PLATFORMS = [
  { value: "google_adsense", label: "Google AdSense" },
  { value: "facebook_marketplace", label: "Facebook Marketplace" },
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta Ads" },
];

export const ADVERTISING_MODULES = [
  {
    id: "advertising.campaign",
    store: "advertising",
    module: "campaign",
    section: "advertising",
    title: "Ad Campaigns",
    singular: "Campaign",
    icon: "megaphone",
    description: "Run and track paid campaigns across your connected ad platforms — objective, spend, and performance in one place.",
    createLabel: "New campaign",
    statuses: statuses({ Active: { variant: "success" }, Paused: { variant: "warning" }, Draft: { variant: "neutral" }, Ended: { variant: "outline" } }),
    defaults: {
      status: "Draft",
      config: { platform: "google_ads", objective: "Traffic", spend: 0, impressions: 0, clicks: 0, conversions: 0, startDate: "", endDate: "", notes: "" },
    },
    summary: ["platform", "objective"],
    create: ["name", "platform", "objective", "status"],
    panels: [
      {
        title: "Campaign",
        fields: [
          nameField("Campaign name", "e.g. Summer Festival — Awareness"),
          statusField(),
          c("platform", "Platform", "select", { options: PLATFORMS }),
          c("objective", "Objective", "select", { options: options(["Awareness", "Traffic", "Leads", "Sales", "App installs"]) }),
          c("startDate", "Start date", "text", { placeholder: "e.g. 2026-07-01" }),
          c("endDate", "End date", "text", { placeholder: "e.g. 2026-07-31" }),
        ],
      },
      {
        title: "Performance",
        description: "The numbers a live platform sync would fill; editable here for now.",
        fields: [
          c("spend", "Spend", "number", { placeholder: "e.g. 1200", min: 0 }),
          c("impressions", "Impressions", "number", { placeholder: "e.g. 45000", min: 0 }),
          c("clicks", "Clicks", "number", { placeholder: "e.g. 1800", min: 0 }),
          c("conversions", "Conversions", "number", { placeholder: "e.g. 120", min: 0 }),
        ],
      },
      { title: "Notes", fields: [c("notes", "Notes", "textarea", { placeholder: "Targeting, creative direction, learnings…" })] },
    ],
    source: SOURCE,
  },
  {
    id: "advertising.budget",
    store: "advertising",
    module: "budget",
    section: "advertising",
    title: "Budgets",
    singular: "Budget",
    icon: "wallet",
    description: "Set spend limits and pacing per platform or campaign, and watch how much of each is already spent.",
    createLabel: "New budget",
    statuses: statuses({ Active: { variant: "success" }, Paused: { variant: "warning" }, Depleted: { variant: "danger" } }),
    defaults: { status: "Active", config: { platform: "google_ads", campaign: "", amount: 0, spent: 0, period: "Monthly", notes: "" } },
    summary: ["platform", "period"],
    create: ["name", "platform", "amount", "status"],
    panels: [
      {
        title: "Budget",
        fields: [
          nameField("Budget name", "e.g. July — Google Ads"),
          statusField(),
          c("platform", "Platform", "select", { options: PLATFORMS }),
          c("campaign", "Campaign", "text", { placeholder: "Which campaign this caps (optional)" }),
          c("amount", "Amount", "number", { placeholder: "e.g. 2000", min: 0 }),
          c("spent", "Spent", "number", { placeholder: "e.g. 850", min: 0 }),
          c("period", "Period", "select", { options: options(["Daily", "Weekly", "Monthly", "Lifetime"]) }),
        ],
      },
      { title: "Notes", fields: [c("notes", "Notes", "textarea", { placeholder: "Pacing rules, cap reasoning…" })] },
    ],
    source: SOURCE,
  },
];
