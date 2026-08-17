"use client";

import { Award } from "lucide-react";

import {
  nameCol,
  statusCol,
  textCol,
  count,
  sum,
  distinct,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
} from "@/components/internal/shared/records/builders";
import { CERTIFICATE_STATUS_MAP } from "../constants";

// ------------------------------------------------------ CEU & Certificates ---
export const CERTIFICATE_MODULE = {
  key: "certificate",
  title: "CEU & Certificates",
  singular: "Certificate",
  icon: Award,
  description:
    "Certificates and continuing-education credits attendees can earn — credit hours, accreditation, and linked sessions.",
  createLabel: "Add certificate",
  searchPlaceholder: "Search certificates, bodies…",
  search: (r) => `${r.name} ${r.config.accreditingBody || ""} ${r.config.kind || ""}`,
  statusMap: CERTIFICATE_STATUS_MAP,
  filters: [
    statusFilter(CERTIFICATE_STATUS_MAP),
    configFilter("kind", ["Certificate", "CEU credit"], "All Types"),
  ],
  columns: [
    nameCol((r) => r.config.kind),
    textCol("creditHours", "Credit hours", (r) => r.config.creditHours),
    textCol("accreditingBody", "Accrediting body", (r) => r.config.accreditingBody),
    statusCol(CERTIFICATE_STATUS_MAP),
  ],
  stats: (records) => [
    { label: "Templates", value: String(records.length), footer: "Certificates & CEUs" },
    { label: "Active", value: String(count(records, (r) => r.status === "Active")), footer: "Issuable now" },
    { label: "Credit hours", value: String(sum(records, (r) => r.config.creditHours)), footer: "Total offered" },
    { label: "Bodies", value: String(distinct(records, (r) => r.config.accreditingBody)), footer: "Accrediting" },
  ],
  defaults: {
    status: "Draft",
    config: { kind: "Certificate", creditHours: 0, accreditingBody: "", sessions: [], description: "" },
  },
  createFields: [
    nameField("Certificate name", "e.g. Certified Attendee"),
    c("kind", "Type", "select", { options: optionsFrom(["Certificate", "CEU credit"]) }),
    c("creditHours", "Credit hours", "number", { placeholder: "e.g. 8" }),
  ],
  detail: {
    depth: "light",
    panels: [
      {
        title: "Certificate details",
        fields: [
          nameField("Certificate name"),
          statusField(CERTIFICATE_STATUS_MAP),
          c("kind", "Type", "select", { options: optionsFrom(["Certificate", "CEU credit"]) }),
          c("creditHours", "Credit hours", "number", { placeholder: "e.g. 8" }),
          c("accreditingBody", "Accrediting body", "text", { placeholder: "e.g. IACET" }),
        ],
      },
      {
        title: "Content",
        fields: [
          c("sessions", "Linked sessions", "list", { placeholder: "Add a session…" }),
          c("description", "Description", "textarea", { placeholder: "What earning this certificate involves…" }),
        ],
      },
    ],
  },
};
