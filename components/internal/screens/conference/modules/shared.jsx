"use client";

import { Image as ImageIcon, ClipboardCheck } from "lucide-react";

import { CoverImageCard } from "@/components/internal/shared/records/record_fields";
import { uploadConferenceImage } from "@/lib/supabase/storage";
import { c } from "@/components/internal/shared/records/builders";
import { TIER_MAP } from "../constants";

// Pieces every Conference module draws on. The generic column/stat/filter/field
// factories are shared suite-wide (records/builders.jsx); what lives here is
// only what is specific to this area — the media section bound to this area's
// uploader, and the small formatters the module configs reuse.

// A media tab for the adaptive detail, backed by the conference uploader.
export const mediaSection = (label, title, aspect, frameClassName) => ({
  key: "media",
  label,
  icon: ImageIcon,
  desc: `The ${title.toLowerCase()} shown for this record.`,
  render: ({ record, commit }) => (
    <CoverImageCard
      record={record}
      commit={commit}
      upload={uploadConferenceImage}
      aspect={aspect}
      frameClassName={frameClassName}
    />
  ),
});

// An inline image field for a create dialog / detail section (no media tab).
export const imageField = (label, hint, aspect) => ({
  key: "coverUrl",
  label,
  hint,
  type: "image",
  scope: "root",
  upload: uploadConferenceImage,
  aspect,
  placeholder: `Upload a ${label.toLowerCase()}`,
});

export const TIER_VALUES = Object.keys(TIER_MAP);

// A promoted starts_at instant as a short local "10 Aug, 14:00". Legacy rows
// still holding display text ("Day 1 · 09:00") fall back to that text.
export const scheduleLabel = (r) => {
  const ms = r.startsAt ? new Date(r.startsAt).getTime() : NaN;
  if (!Number.isFinite(ms)) return r.config.scheduledFor || r.config.premiereAt || "";
  return new Date(ms).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Sum one measured presence metric across the loaded rows.
export const presenceSum = (records, presence, key) =>
  records.reduce((s, r) => s + (presence[r.id]?.[key] || 0), 0);

// The access section every gated module shares.
export const accessSection = (desc) => ({
  key: "access",
  label: "Access",
  icon: ClipboardCheck,
  desc,
  fields: [c("access", "Access model", "access")],
});
