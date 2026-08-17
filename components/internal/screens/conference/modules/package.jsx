"use client";

import { Package } from "lucide-react";

import {
  nameCol,
  statusCol,
  pillCol,
  textCol,
  moneyCol,
  count,
  sum,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
  currency,
} from "@/components/internal/shared/records/builders";
import { PACKAGE_STATUS_MAP, TIER_MAP } from "../constants";
import { TIER_VALUES } from "./shared";

// -------------------------------------------------- Sponsorship Packages ---
export const PACKAGE_MODULE = {
  key: "package",
  title: "Sponsorship Packages",
  singular: "Package",
  icon: Package,
  description:
    "Reusable sponsorship tiers you sell — price, available slots, and the benefits each includes.",
  createLabel: "Add package",
  searchPlaceholder: "Search packages…",
  search: (r) => `${r.name} ${r.config.tier || ""}`,
  statusMap: PACKAGE_STATUS_MAP,
  filters: [
    statusFilter(PACKAGE_STATUS_MAP),
    configFilter("tier", TIER_VALUES, "All tiers"),
  ],
  columns: [
    nameCol((r) => r.config.tier),
    pillCol("tier", "Tier", (r) => r.config.tier, TIER_MAP),
    moneyCol("price", "Price", (r) => r.config.price),
    textCol("slots", "Slots", (r) => `${Number(r.config.sold) || 0} / ${Number(r.config.slots) || 0}`),
    statusCol(PACKAGE_STATUS_MAP),
  ],
  stats: (records) => [
    { label: "Packages", value: String(records.length), footer: "All Statuses" },
    { label: "Total value", value: currency(sum(records, (r) => (Number(r.config.price) || 0) * (Number(r.config.slots) || 0))), footer: "If fully sold" },
    { label: "Slots sold", value: String(sum(records, (r) => r.config.sold)), footer: "Across packages" },
    { label: "Available", value: String(count(records, (r) => r.status === "Available")), footer: "On sale" },
  ],
  defaults: {
    status: "Draft",
    config: { tier: "Gold", price: 0, slots: 0, sold: 0, benefits: [], description: "" },
  },
  createFields: [
    nameField("Package name", "e.g. Gold Sponsor"),
    c("tier", "Tier", "select", { options: optionsFrom(TIER_VALUES) }),
    c("price", "Price", "number", { placeholder: "e.g. 10000" }),
  ],
  detail: {
    depth: "light",
    panels: [
      {
        title: "Package details",
        fields: [
          nameField("Package name"),
          statusField(PACKAGE_STATUS_MAP),
          c("tier", "Tier", "select", { options: optionsFrom(TIER_VALUES) }),
          c("price", "Price", "number", { placeholder: "e.g. 10000" }),
          c("slots", "Total slots", "number", { placeholder: "e.g. 4" }),
          c("sold", "Slots sold", "number", { placeholder: "e.g. 2" }),
        ],
      },
      {
        title: "Benefits",
        fields: [
          c("description", "Description", "textarea", { placeholder: "What this package includes…" }),
          c("benefits", "Benefits", "list", { placeholder: "Add a benefit…" }),
        ],
      },
    ],
  },
};
