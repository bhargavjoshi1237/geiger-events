"use client";

import { Captions } from "lucide-react";

import {
  nameCol,
  statusCol,
  pillCol,
  textCol,
  count,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
} from "@/components/internal/shared/records/builders";
import { CAPTION_MODE_MAP, CAPTION_STATUS_MAP } from "../constants";

// ------------------------------------------------- Captions & Transcription ---
export const CAPTION_MODULE = {
  key: "caption",
  title: "Captions & Transcription",
  singular: "Caption job",
  icon: Captions,
  description:
    "Live captions and transcripts for each session — the language coverage, the provider, and the finished transcript to download.",
  createLabel: "Add caption job",
  searchPlaceholder: "Search sessions, providers, languages…",
  search: (r) => `${r.name} ${r.config.session || ""} ${r.config.provider || ""} ${(r.config.languages || []).join(" ")}`,
  statusMap: CAPTION_STATUS_MAP,
  filters: [
    statusFilter(CAPTION_STATUS_MAP),
    configFilter("mode", ["Live CART", "AI auto", "Post-edited"], "All modes"),
  ],
  columns: [
    nameCol((r) => r.config.session),
    pillCol("mode", "Mode", (r) => r.config.mode, CAPTION_MODE_MAP),
    textCol("languages", "Languages", (r) => (r.config.languages || []).length || ""),
    textCol("accuracy", "Accuracy", (r) => (r.config.accuracy ? `${r.config.accuracy}%` : "")),
    statusCol(CAPTION_STATUS_MAP),
  ],
  stats: (records) => {
    const langs = new Set(
      records.flatMap((r) => (r.config.languages || []).map((l) => l.trim().toLowerCase())).filter(Boolean),
    );
    return [
      { label: "Jobs", value: String(records.length), footer: "All sessions" },
      { label: "Live", value: String(count(records, (r) => r.status === "Live")), footer: "Captioning now" },
      { label: "Ready", value: String(count(records, (r) => r.status === "Ready")), footer: "Transcripts done" },
      { label: "Languages", value: String(langs.size), footer: "Covered" },
    ];
  },
  defaults: {
    status: "Requested",
    config: {
      session: "", mode: "AI auto", provider: "", sourceLanguage: "English",
      languages: [], accuracy: "", wordCount: 0, transcriptUrl: "",
      downloadable: false, eventId: "", notes: "",
    },
  },
  createFields: [
    nameField("Job name", "e.g. Keynote — Live captions"),
    c("session", "Session", "text", { placeholder: "e.g. Opening Keynote" }),
    c("mode", "Mode", "select", { options: optionsFrom(["Live CART", "AI auto", "Post-edited"]) }),
  ],
  detail: {
    depth: "light",
    panels: [
      {
        title: "Caption job",
        fields: [
          nameField("Job name"),
          statusField(CAPTION_STATUS_MAP),
          c("session", "Session"),
          c("mode", "Mode", "select", { options: optionsFrom(["Live CART", "AI auto", "Post-edited"]) }),
          c("provider", "Provider", "text", { placeholder: "e.g. Verbit, Otter, in-house" }),
        ],
      },
      {
        title: "Languages & quality",
        fields: [
          c("sourceLanguage", "Source language", "text", { placeholder: "e.g. English" }),
          c("languages", "Caption languages", "list", { placeholder: "Add a language…" }),
          c("accuracy", "Accuracy", "number", { placeholder: "e.g. 98" }),
        ],
      },
      {
        title: "Output",
        fields: [
          c("transcriptUrl", "Transcript link", "text", { placeholder: "https://…" }),
          c("wordCount", "Word count", "number", { placeholder: "e.g. 8400" }),
          c("downloadable", "Downloadable by attendees", "switch", { hint: "Let attendees download the transcript." }),
          c("notes", "Notes", "textarea", { placeholder: "Glossary, speaker names, corrections…" }),
        ],
      },
    ],
  },
};
