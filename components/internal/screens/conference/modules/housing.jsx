"use client";

import { Plane, SquarePen, ClipboardList } from "lucide-react";

import {
  nameCol,
  statusCol,
  textCol,
  moneyCol,
  sum,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
  pct,
} from "@/components/internal/shared/records/builders";
import { HOUSING_STATUS_MAP } from "../constants";

// -------------------------------------------------------- Housing & Travel ---
export const HOUSING_MODULE = {
  key: "housing",
  title: "Housing & Travel",
  singular: "Option",
  icon: Plane,
  description:
    "Hotel room blocks and travel options for attendees — rates, inventory, and booking links.",
  createLabel: "Add option",
  searchPlaceholder: "Search hotels, cities…",
  search: (r) => `${r.name} ${r.config.city || ""} ${r.config.kind || ""}`,
  statusMap: HOUSING_STATUS_MAP,
  filters: [
    statusFilter(HOUSING_STATUS_MAP),
    configFilter("kind", ["Hotel", "Apartment", "Transport"], "All Types"),
  ],
  columns: [
    nameCol((r) => r.config.city),
    textCol("kind", "Type", (r) => r.config.kind),
    moneyCol("ratePerNight", "Rate / night", (r) => r.config.ratePerNight),
    textCol("rooms", "Rooms", (r) => `${Number(r.config.roomsBooked) || 0} / ${Number(r.config.roomsBlocked) || 0}`),
    statusCol(HOUSING_STATUS_MAP),
  ],
  stats: (records) => {
    const blocked = sum(records, (r) => r.config.roomsBlocked);
    const booked = sum(records, (r) => r.config.roomsBooked);
    return [
      { label: "Options", value: String(records.length), footer: "Hotels & travel" },
      { label: "Rooms blocked", value: String(blocked), footer: "Total held" },
      { label: "Rooms booked", value: String(booked), footer: "Claimed" },
      { label: "Occupancy", value: pct(blocked ? (booked / blocked) * 100 : 0), footer: "Of blocked rooms" },
    ];
  },
  defaults: {
    status: "Available",
    config: { kind: "Hotel", city: "", address: "", ratePerNight: 0, roomsBlocked: 0, roomsBooked: 0, bookingLink: "", notes: "" },
  },
  createFields: [
    nameField("Name", "e.g. Grand Central Hotel"),
    c("kind", "Type", "select", { options: optionsFrom(["Hotel", "Apartment", "Transport"]) }),
    c("city", "City", "text", { placeholder: "e.g. Amsterdam" }),
  ],
  detail: {
    depth: "rich",
    nav: [
      {
        key: "details",
        label: "Option details",
        icon: SquarePen,
        desc: "Type, location, status, and the nightly rate.",
        fields: [
          nameField("Name"),
          statusField(HOUSING_STATUS_MAP),
          c("kind", "Type", "select", { options: optionsFrom(["Hotel", "Apartment", "Transport"]) }),
          c("city", "City"),
          c("address", "Address"),
          c("ratePerNight", "Rate / night", "number", { placeholder: "e.g. 180" }),
        ],
      },
      {
        key: "inventory",
        label: "Inventory",
        icon: ClipboardList,
        desc: "Rooms held vs. booked, plus the booking link.",
        fields: [
          c("roomsBlocked", "Rooms blocked", "number", { placeholder: "e.g. 40" }),
          c("roomsBooked", "Rooms booked", "number", { placeholder: "e.g. 12" }),
          c("bookingLink", "Booking link", "text", { placeholder: "https://…" }),
          c("notes", "Notes", "textarea", { placeholder: "Cut-off date, group code…" }),
        ],
      },
    ],
  },
};
