"use client";

import React from "react";
import { LayoutTemplate } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { RecordsScreen } from "../tickets/records_kit";
import {
  listAssets,
  createAsset,
  updateAsset,
  softDeleteAsset,
} from "@/lib/supabase/campaigns";
import {
  MERGE_TAGS,
  TEMPLATE_CATEGORY_OPTIONS,
  defaultTemplateConfig,
} from "./constants";

// Campaign assets data adapter (module = 'template'). Module-level constant so
// RecordsScreen's mount effect has a stable reference.
const TEMPLATE_DATA = {
  list: listAssets,
  create: createAsset,
  update: updateAsset,
  remove: softDeleteAsset,
};

const KINDS = [
  { value: "template", label: "Template", defaultConfig: defaultTemplateConfig },
];

function summarize(r) {
  const c = r.config || {};
  const cat =
    TEMPLATE_CATEGORY_OPTIONS.find((o) => o.value === c.category)?.label || "General";
  const words = (c.body || "").trim() ? `${(c.body || "").trim().split(/\s+/).length} words` : "empty";
  return `${cat} · ${words}`;
}

function TemplateEditForm({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  return (
    <div className="space-y-6">
      <SectionCard
        title="Template details"
        description="Reusable content you can load into any email campaign."
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject">
              <Input
                value={config.subject || ""}
                onChange={(e) => set({ subject: e.target.value })}
                placeholder="e.g. You're invited to {{event_name}}"
              />
            </Field>
            <Field label="Category">
              <Select
                value={config.category || "general"}
                onValueChange={(v) => set({ category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Preview text" hint="Shown after the subject in most inboxes.">
            <Input
              value={config.previewText || ""}
              onChange={(e) => set({ previewText: e.target.value })}
              placeholder="Optional preheader"
            />
          </Field>
          <Field label="Body">
            <Textarea
              rows={10}
              value={config.body || ""}
              onChange={(e) => set({ body: e.target.value })}
              placeholder="Write your reusable email content…"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Merge tags"
        description="Drop these into the subject or body — they're replaced per recipient at send time."
      >
        <div className="flex flex-wrap gap-2">
          {MERGE_TAGS.map((m) => (
            <span
              key={m.tag}
              className="rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-text-secondary"
              title={m.label}
            >
              <code>{m.tag}</code>
            </span>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export function EmailTemplateBuilderScreen() {
  return (
    <RecordsScreen
      module="template"
      title="Email Template Builder"
      description="Reusable email templates. Build one here, then load it into any email campaign from its Content section."
      singular="template"
      icon={LayoutTemplate}
      kinds={KINDS}
      summarize={summarize}
      EditForm={TemplateEditForm}
      data={TEMPLATE_DATA}
    />
  );
}

export default EmailTemplateBuilderScreen;
