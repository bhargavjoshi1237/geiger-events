"use client";

import {
  SquarePen,
  CalendarCheck,
  ListChecks,
  Target,
  Send,
} from "lucide-react";

import { SessionMultiField, AgendaAssignHero } from "../detail_fields";
import { describeSpec } from "@/lib/audience/resolve";
import {
  nameCol,
  statusCol,
  textCol,
  count,
  sum,
  statusFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
} from "@/components/internal/shared/records/builders";
import {
  AGENDA_ASSIGN_STATUS_MAP,
  AGENDA_DELIVERY_OPTIONS,
} from "../constants";

// ------------------------------------------------------------ Assign Agenda ---
export const AGENDA_ASSIGNMENT_MODULE = {
  key: "agenda_assignment",
  title: "Assign Agenda",
  singular: "Agenda",
  icon: CalendarCheck,
  description:
    "Curate a set of sessions and assign it to a controlled group of guests — everyone or a subset by segment, tag, ticket, offering, add-on, status, or specific people, just like Community.",
  createLabel: "Create agenda",
  searchPlaceholder: "Search agendas…",
  search: (r) => `${r.name} ${r.config.description || ""}`,
  statusMap: AGENDA_ASSIGN_STATUS_MAP,
  filters: [statusFilter(AGENDA_ASSIGN_STATUS_MAP)],
  columns: [
    nameCol((r) => r.config.description),
    textCol("sessions", "Sessions", (r) => (r.config.sessionIds || []).length || ""),
    textCol("audience", "Audience", (r) => describeSpec(r.config.audience)),
    statusCol(AGENDA_ASSIGN_STATUS_MAP),
  ],
  stats: (records) => [
    { label: "Agendas", value: String(records.length), footer: "All Statuses" },
    { label: "Published", value: String(count(records, (r) => r.status === "Published")), footer: "Assigned live" },
    { label: "Sessions assigned", value: String(sum(records, (r) => (r.config.sessionIds || []).length)), footer: "Across agendas" },
    { label: "Drafts", value: String(count(records, (r) => r.status === "Draft")), footer: "Not yet live" },
  ],
  defaults: {
    status: "Draft",
    config: {
      sessionIds: [],
      audience: { eventId: "", emails: [] },
      description: "",
      deliverVia: "In-app",
      scheduledFor: "",
      notify: false,
    },
  },
  createFields: [
    nameField("Agenda name", "e.g. VIP Track"),
    c("audience", "Audience", "audience", {
      hint: "Everyone, or a subset — by event, ticket, offering, add-on, tag, segment, status, or specific people.",
      full: true,
    }),
  ],
  detail: {
    depth: "rich",
    hero: AgendaAssignHero,
    nav: [
      {
        key: "details",
        label: "Agenda",
        icon: SquarePen,
        desc: "Name it, set where it is in its lifecycle, and describe what it's for.",
        fields: [
          nameField("Agenda name"),
          { ...statusField(AGENDA_ASSIGN_STATUS_MAP), type: "tabs" },
          c("description", "Description", "textarea", { placeholder: "What this agenda is and who it's for…" }),
        ],
      },
      {
        key: "sessions",
        label: "Sessions",
        icon: ListChecks,
        desc: "Curate the sessions this agenda includes.",
        render: ({ record, commit }) => <SessionMultiField record={record} commit={commit} />,
      },
      {
        key: "audience",
        label: "Audience",
        icon: Target,
        desc: "Choose the controlled group this agenda is assigned to.",
        fields: [c("audience", "", "audience", { full: true })],
      },
      {
        key: "delivery",
        label: "Delivery",
        icon: Send,
        desc: "How and when assigned guests receive this agenda.",
        fields: [
          c("deliverVia", "Deliver via", "select", { options: optionsFrom(AGENDA_DELIVERY_OPTIONS) }),
          c("scheduledFor", "Send at", "text", { placeholder: "e.g. 2026-06-01 09:00 (leave blank to send now)" }),
          c("notify", "Notify guests when published", "switch", { hint: "Push a notification when this agenda goes live." }),
        ],
      },
    ],
  },
};
