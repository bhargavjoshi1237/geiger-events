"use client";

import { MapPin, SquarePen, Contact } from "lucide-react";

import {
  nameCol,
  statusCol,
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
import { VENUE_LEAD_STATUS_MAP } from "../constants";

// --------------------------------------------------------- Venue Sourcing ---
export const VENUE_LEAD_MODULE = {
  key: "venue_lead",
  title: "Venue Sourcing",
  singular: "Venue lead",
  icon: MapPin,
  description:
    "Prospective venues under evaluation — track the pipeline from shortlist to booked, with quotes and contacts.",
  createLabel: "Add venue lead",
  searchPlaceholder: "Search venues, cities, contacts…",
  search: (r) => `${r.name} ${r.config.city || ""} ${r.config.contactName || ""}`,
  statusMap: VENUE_LEAD_STATUS_MAP,
  filters: [statusFilter(VENUE_LEAD_STATUS_MAP)],
  columns: [
    nameCol((r) => r.config.city),
    textCol("capacity", "Capacity", (r) => (Number(r.config.capacity) || 0).toLocaleString("en-US")),
    moneyCol("quotedPrice", "Quote", (r) => r.config.quotedPrice),
    textCol("rating", "Rating", (r) => (r.config.rating ? `${r.config.rating}/5` : "")),
    statusCol(VENUE_LEAD_STATUS_MAP),
  ],
  stats: (records) => [
    { label: "Leads", value: String(records.length), footer: "In pipeline" },
    { label: "Shortlisted", value: String(count(records, (r) => r.status === "Shortlisted")), footer: "Under review" },
    { label: "Booked", value: String(count(records, (r) => r.status === "Booked")), footer: "Secured" },
    { label: "Avg quote", value: currency(records.length ? sum(records, (r) => r.config.quotedPrice) / records.length : 0), footer: "Across leads" },
  ],
  defaults: {
    status: "Shortlisted",
    config: { city: "", capacity: 0, quotedPrice: 0, contactName: "", contactEmail: "", rating: "", notes: "" },
  },
  createFields: [
    nameField("Venue name", "e.g. Riverside Hall"),
    c("city", "City", "text", { placeholder: "e.g. Berlin" }),
    statusField(VENUE_LEAD_STATUS_MAP),
  ],
  detail: {
    depth: "rich",
    nav: [
      {
        key: "details",
        label: "Details",
        icon: SquarePen,
        desc: "Location, capacity, status, and the quoted price.",
        fields: [
          nameField("Venue name"),
          statusField(VENUE_LEAD_STATUS_MAP),
          c("city", "City"),
          c("capacity", "Capacity", "number", { placeholder: "e.g. 800" }),
          c("quotedPrice", "Quoted price", "number", { placeholder: "e.g. 20000" }),
          c("rating", "Rating", "select", { options: optionsFrom(["1", "2", "3", "4", "5"]) }),
        ],
      },
      {
        key: "contact",
        label: "Contact & notes",
        icon: Contact,
        desc: "Who to reach and any notes on this lead.",
        fields: [
          c("contactName", "Contact name"),
          c("contactEmail", "Email", "email", { placeholder: "name@example.com" }),
          c("notes", "Notes", "textarea", { placeholder: "Availability, catering, AV, terms…" }),
        ],
      },
    ],
  },
};
