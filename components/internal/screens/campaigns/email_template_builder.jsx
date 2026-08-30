"use client";

import React from "react";
import { toast } from "sonner";
import { Copy, LayoutTemplate } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";

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

const TEMPLATE_DATA = {
  list: listAssets,
  create: createAsset,
  update: updateAsset,
  remove: softDeleteAsset,
};

const KINDS = [
  { value: "template", label: "Template", defaultConfig: defaultTemplateConfig },
];

function copyTag(tag) {
  try {
    navigator.clipboard?.writeText(tag);
    toast.success(`Copied ${tag}`);
  } catch {
    toast.error("Couldn't copy to clipboard.");
  }
}

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
                className="bg-surface-card"
              />
            </Field>
            <Field label="Category">
              <Select
                value={config.category || "general"}
                onValueChange={(v) => set({ category: v })}
              >
                <SelectTrigger className="bg-surface-card">
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
              className="bg-surface-card"
            />
          </Field>
          <Field label="Body">
            <Textarea
              rows={10}
              value={config.body || ""}
              onChange={(e) => set({ body: e.target.value })}
              placeholder="Write your reusable email content…"
              className="bg-surface-card"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Merge tags"
        description="Drop these into the subject or body — they're replaced per recipient at send time."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {MERGE_TAGS.map((m) => (
            <button
              key={m.tag}
              type="button"
              onClick={() => copyTag(m.tag)}
              className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2 text-left transition-colors hover:bg-surface-hover"
            >
              <div className="min-w-0">
                <code className="text-sm text-foreground">{m.tag}</code>
                <p className="text-xs text-text-secondary">{m.label}</p>
              </div>
              <Copy className="h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-muted-foreground" />
            </button>
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
