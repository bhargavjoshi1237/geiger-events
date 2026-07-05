"use client";

import React from "react";

import {
  EditorSectionHeader,
  Field,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventConfig } from "@/lib/events/use-event-config";

// --- Basics (name, summary, format) ------------------------------------------

export function BasicsSection({ event, headerItem, onPatch }) {
  // Controlled directly off the lifted event so edits flow to the header,
  // preview, and (on Save) back to the list. No section-local copy to drift.
  const patch = onPatch || (() => {});

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Event details"}
        description={headerItem?.desc}
      />
      <div className="grid gap-4">
        <Field label="Event name">
          <Input
            value={event?.name || ""}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="What's it called?"
          />
        </Field>
        <Field
          label="Short summary"
          hint="Shown in listings and social previews."
        >
          <Textarea
            value={event?.summary || ""}
            onChange={(e) => patch({ summary: e.target.value })}
            rows={3}
            placeholder="One or two lines that sell the event."
          />
        </Field>
        <Field label="Format">
          <Select
            value={event?.type || "In-person"}
            onValueChange={(v) => patch({ type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="In-person">In-person</SelectItem>
              <SelectItem value="Online">Online</SelectItem>
              <SelectItem value="Hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

// --- Registration settings ---------------------------------------------------

const DEFAULT_REG_SETTINGS = { requireApproval: false, showRemaining: true };

export function RegistrationSettingsSection({ event, headerItem }) {
  const [settings, , saveSettings] = useEventConfig(
    event,
    "regSettings",
    DEFAULT_REG_SETTINGS,
  );
  const set = (key) => (value) =>
    saveSettings({ ...settings, [key]: value });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Registration Settings"}
        description={headerItem?.desc}
      />
      <SettingsList>
        <SettingRow
          title="Require approval"
          description="Manually approve each registration before it's confirmed."
          checked={settings.requireApproval}
          onCheckedChange={set("requireApproval")}
        />
        <SettingRow
          title="Show tickets remaining"
          description="Display a live count of remaining tickets on the event page."
          checked={settings.showRemaining}
          onCheckedChange={set("showRemaining")}
        />
      </SettingsList>
    </div>
  );
}
