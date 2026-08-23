"use client";

import { Handshake, SquarePen, Contact, Gift } from "lucide-react";

import {
  avatarNameCol,
  textCol,
  moneyCol,
  count,
  sum,
  nameField,
  c,
  currency,
  numberSort,
} from "@/components/internal/shared/records/builders";
import { mediaSection, imageField } from "./shared";

// -------------------------------------------------------------- Sponsors ---
// Sponsors are deliberately status- and tier-free: a sponsor is just the
// company, its logo, what it does, and the amount committed.
export const SPONSOR_MODULE = {
  key: "sponsor",
  title: "Sponsors",
  singular: "Sponsor",
  icon: Handshake,
  description:
    "Companies backing your events — their logo, a short description, the amount committed, and who to contact.",
  createLabel: "Add sponsor",
  searchPlaceholder: "Search sponsors, contacts…",
  search: (r) =>
    `${r.name} ${r.config.contactName || ""} ${r.config.description || ""}`,
  filters: [],
  sorts: [numberSort("amount", (r) => r.config.amount, "Amount donated")],
  columns: [
    avatarNameCol((r) => r.config.description, { shape: "square" }),
    textCol("contact", "Contact", (r) => r.config.contactName),
    moneyCol("amount", "Amount", (r) => r.config.amount),
  ],
  stats: (records) => [
    { label: "Sponsors", value: String(records.length), footer: "In this project" },
    { label: "Sponsorship", value: currency(sum(records, (r) => r.config.amount)), footer: "Total committed" },
    { label: "Average", value: currency(records.length ? sum(records, (r) => r.config.amount) / records.length : 0), footer: "Per sponsor" },
    { label: "With a logo", value: String(count(records, (r) => !!r.coverUrl)), footer: "Ready for the event page" },
  ],
  defaults: {
    // Not surfaced anywhere — the column is NOT NULL, so keep it constant.
    status: "Active",
    config: { amount: 0, contactName: "", contactEmail: "", website: "", description: "", benefits: [] },
  },
  createFields: [
    nameField("Company name", "e.g. Northwind Labs"),
    c("description", "Description", "textarea", {
      placeholder: "What they do, and what the sponsorship covers…",
    }),
    imageField("Logo", "Shown on the event page and in sponsor reporting.", "aspect-[16/9]"),
  ],
  detail: {
    depth: "rich",
    nav: [
      {
        key: "details",
        label: "Details",
        icon: SquarePen,
        desc: "The company, what they do, and the committed amount.",
        fields: [
          nameField("Company name"),
          c("amount", "Amount", "number", { placeholder: "e.g. 15000" }),
          c("description", "Description", "textarea", {
            placeholder: "What they do, and what the sponsorship covers…",
          }),
        ],
      },
      {
        key: "contact",
        label: "Contact",
        icon: Contact,
        desc: "Who to reach and where to find them.",
        fields: [
          c("contactName", "Contact name"),
          c("contactEmail", "Email", "email", { placeholder: "name@example.com" }),
          c("website", "Website", "text", { placeholder: "https://…" }),
        ],
      },
      {
        key: "benefits",
        label: "Benefits",
        icon: Gift,
        desc: "What this sponsorship includes.",
        fields: [c("benefits", "Benefits", "list", { placeholder: "Add a benefit…" })],
      },
      mediaSection("Logo", "Logo", "aspect-[16/9]"),
    ],
  },
};
