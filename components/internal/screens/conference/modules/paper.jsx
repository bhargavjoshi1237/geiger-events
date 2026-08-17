"use client";

import { FileText, BookOpen, ClipboardList } from "lucide-react";

import {
  nameCol,
  statusCol,
  textCol,
  count,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
  pct,
} from "@/components/internal/shared/records/builders";
import { PAPER_STATUS_MAP } from "../constants";

// --------------------------------------------------------- Call for Papers ---
export const PAPER_MODULE = {
  key: "paper",
  title: "Call for Papers",
  singular: "Submission",
  icon: FileText,
  description:
    "Session proposals submitted for review — score them, track status, and accept the best.",
  createLabel: "Add submission",
  searchPlaceholder: "Search titles, authors, tracks…",
  search: (r) => `${r.name} ${r.config.authorName || ""} ${r.config.track || ""}`,
  statusMap: PAPER_STATUS_MAP,
  filters: [
    statusFilter(PAPER_STATUS_MAP),
    configFilter("format", ["Talk", "Workshop", "Panel"], "All formats"),
  ],
  columns: [
    nameCol((r) => r.config.authorName),
    textCol("track", "Track", (r) => r.config.track),
    textCol("format", "Format", (r) => r.config.format),
    textCol("score", "Score", (r) => (r.config.score ? `${r.config.score}/5` : "")),
    statusCol(PAPER_STATUS_MAP),
  ],
  stats: (records) => [
    { label: "Submissions", value: String(records.length), footer: "Received" },
    { label: "Accepted", value: String(count(records, (r) => r.status === "Accepted")), footer: "On the agenda" },
    { label: "Under review", value: String(count(records, (r) => r.status === "Under review")), footer: "Being scored" },
    { label: "Accept rate", value: pct(records.length ? (count(records, (r) => r.status === "Accepted") / records.length) * 100 : 0), footer: "Of submissions" },
  ],
  defaults: {
    status: "Submitted",
    config: { authorName: "", email: "", track: "", format: "Talk", abstract: "", score: "", reviewerNotes: "", topics: [] },
  },
  createFields: [
    nameField("Title", "e.g. Scaling Realtime Systems"),
    c("authorName", "Author", "text", { placeholder: "e.g. Grace Hopper" }),
    c("format", "Format", "select", { options: optionsFrom(["Talk", "Workshop", "Panel"]) }),
  ],
  detail: {
    depth: "rich",
    nav: [
      {
        key: "submission",
        label: "Submission",
        icon: FileText,
        desc: "Title, author, track, format, and status.",
        fields: [
          nameField("Title"),
          statusField(PAPER_STATUS_MAP),
          c("authorName", "Author"),
          c("email", "Email", "email", { placeholder: "name@example.com" }),
          c("track", "Track", "text", { placeholder: "e.g. Engineering" }),
          c("format", "Format", "select", { options: optionsFrom(["Talk", "Workshop", "Panel"]) }),
        ],
      },
      {
        key: "abstract",
        label: "Abstract",
        icon: BookOpen,
        desc: "The proposed session's abstract and topics.",
        fields: [
          c("abstract", "Abstract", "textarea", { rows: 8, placeholder: "The full session abstract…" }),
          c("topics", "Topics", "list", { placeholder: "Add a topic…" }),
        ],
      },
      {
        key: "review",
        label: "Review",
        icon: ClipboardList,
        desc: "Reviewer score and notes.",
        fields: [
          c("score", "Score", "select", { options: optionsFrom(["1", "2", "3", "4", "5"]) }),
          c("reviewerNotes", "Reviewer notes", "textarea", { placeholder: "Strengths, concerns, recommendation…" }),
        ],
      },
    ],
  },
};
