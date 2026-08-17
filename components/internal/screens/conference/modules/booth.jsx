"use client";

import { Store } from "lucide-react";

import {
  nameCol,
  statusCol,
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
import { BOOTH_STATUS_MAP } from "../constants";

// ------------------------------------------------------------ Expo Booths ---
export const BOOTH_MODULE = {
  key: "booth",
  title: "Expo Booths",
  singular: "Booth",
  icon: Store,
  description:
    "The exhibitor floor — booths, their hall and size, who's assigned, and what they cost.",
  createLabel: "Add booth",
  searchPlaceholder: "Search booths, halls, exhibitors…",
  search: (r) => `${r.name} ${r.config.hall || ""} ${r.config.exhibitor || ""}`,
  statusMap: BOOTH_STATUS_MAP,
  filters: [
    statusFilter(BOOTH_STATUS_MAP),
    configFilter("size", ["Standard", "Large", "Premium"], "All sizes"),
  ],
  columns: [
    nameCol((r) => r.config.hall),
    textCol("size", "Size", (r) => r.config.size),
    textCol("exhibitor", "Exhibitor", (r) => r.config.exhibitor),
    moneyCol("price", "Price", (r) => r.config.price),
    statusCol(BOOTH_STATUS_MAP),
  ],
  stats: (records) => [
    { label: "Booths", value: String(records.length), footer: "On the floor" },
    { label: "Occupied", value: String(count(records, (r) => r.status === "Occupied")), footer: "Assigned" },
    { label: "Available", value: String(count(records, (r) => r.status === "Available")), footer: "Open to book" },
    { label: "Revenue", value: currency(sum(records, (r) => (r.status === "Occupied" ? r.config.price : 0))), footer: "From occupied" },
  ],
  defaults: {
    status: "Available",
    config: { hall: "", size: "Standard", exhibitor: "", price: 0, notes: "" },
  },
  createFields: [
    nameField("Booth name / number", "e.g. Booth A12"),
    c("hall", "Hall / zone", "text", { placeholder: "e.g. Hall 1" }),
    c("size", "Size", "select", { options: optionsFrom(["Standard", "Large", "Premium"]) }),
  ],
  detail: {
    depth: "light",
    panels: [
      {
        title: "Booth details",
        fields: [
          nameField("Booth name / number"),
          statusField(BOOTH_STATUS_MAP),
          c("hall", "Hall / zone"),
          c("size", "Size", "select", { options: optionsFrom(["Standard", "Large", "Premium"]) }),
          c("exhibitor", "Exhibitor"),
          c("price", "Price", "number", { placeholder: "e.g. 2500" }),
        ],
      },
      { title: "Notes", fields: [c("notes", "Notes", "textarea", { placeholder: "Setup, power, neighbours…" })] },
    ],
  },
};
