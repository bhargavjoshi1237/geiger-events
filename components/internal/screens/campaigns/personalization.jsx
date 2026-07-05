"use client";

import React from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignSettingsScreen } from "./campaigns_kit";
import { MERGE_TAGS, TONE_OPTIONS } from "./constants";

// Copy a merge tag to the clipboard for pasting into campaign content.
function copyTag(tag) {
  try {
    navigator.clipboard?.writeText(tag);
    toast.success(`Copied ${tag}`);
  } catch {
    toast.error("Couldn't copy to clipboard.");
  }
}

export function PersonalizationScreen() {
  return (
    <CampaignSettingsScreen
      title="Personalization"
      description="Merge tags and defaults that make every message feel one-to-one."
      feature="personalization"
    >
      {({ slice, set }) => (
        <>
          <SectionCard
            title="Defaults"
            description="Applied across campaigns unless overridden on an individual send."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default greeting" hint="Use merge tags like {{first_name}}.">
                <Input
                  value={slice.greeting}
                  onChange={(e) => set({ greeting: e.target.value })}
                  placeholder="Hi {{first_name}},"
                />
              </Field>
              <Field
                label="Name fallback"
                hint="Used when a contact has no first name."
              >
                <Input
                  value={slice.fallbackName}
                  onChange={(e) => set({ fallbackName: e.target.value })}
                  placeholder="there"
                />
              </Field>
              <Field label="Tone">
                <Select value={slice.tone} onValueChange={(v) => set({ tone: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <SettingsList>
                <SettingRow
                  title="Time-zone aware sending"
                  description="Deliver at the recipient's local time where known."
                  checked={!!slice.timezoneAware}
                  onCheckedChange={(v) => set({ timezoneAware: v })}
                />
                <SettingRow
                  title="Always include unsubscribe"
                  description="Append the unsubscribe link to every email automatically."
                  checked={!!slice.includeUnsubscribe}
                  onCheckedChange={(v) => set({ includeUnsubscribe: v })}
                />
              </SettingsList>
            </div>
          </SectionCard>

          <SectionCard
            title="Merge tags"
            description="Drop these into any subject or body — they're replaced per recipient at send time."
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
        </>
      )}
    </CampaignSettingsScreen>
  );
}

export default PersonalizationScreen;
