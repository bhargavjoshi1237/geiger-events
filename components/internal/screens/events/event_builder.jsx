"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, UploadCloud } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventConfig } from "@/lib/events/use-event-config";
import { updateEventMeta } from "@/lib/supabase/events";
import {
  uploadEventImage,
  removeEventImage,
  pathFromPublicUrl,
} from "@/lib/supabase/storage";
import { EventDatePicker, EventTimeSelect } from "./date_time_fields";
import { initials } from "./sample_data";

// --- Basics (name, summary, format) ------------------------------------------

export function BasicsSection({ event, headerItem, onPatch }) {
  // Controlled directly off the lifted event so edits flow to the header,
  // preview, and (on Save) back to the list. No section-local copy to drift.
  const patch = onPatch || (() => {});

  // The organiser's photo lives in the metadata bag rather than a column, so it
  // can't ride the form's Save Changes — it persists the moment it's uploaded,
  // the way cover media does.
  const organizerAvatar = event?.organizerAvatar || "";
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInput = useRef(null);

  const saveAvatar = async (url, previous, successMsg) => {
    patch({ organizerAvatar: url });
    const saved = await updateEventMeta(event?.id, { organizerAvatar: url });
    if (saved === false) {
      patch({ organizerAvatar: previous });
      toast.error("Couldn't save the organizer photo.");
      return;
    }
    toast.success(successMsg);
    const oldPath = pathFromPublicUrl(previous);
    if (oldPath) removeEventImage(oldPath);
  };

  const onAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setAvatarBusy(true);
    const res = await uploadEventImage(event?.id, file);
    if (!res?.url) {
      setAvatarBusy(false);
      toast.error("Upload failed — only the event's creator can add images.");
      return;
    }
    await saveAvatar(res.url, organizerAvatar, "Organizer photo updated.");
    setAvatarBusy(false);
  };

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
        {/* The name credited on the public page's host block ("Hosted by") —
            co-hosts come from the event's team, this is the lead. */}
        <Field
          label="Organizer"
          hint="Shown as “Hosted by” on your event page. Without a photo it falls back to your Event Wall logo, then to initials."
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 shrink-0 border border-border">
              {organizerAvatar ? (
                <AvatarImage src={organizerAvatar} alt="" />
              ) : null}
              <AvatarFallback className="bg-surface-card text-sm text-muted-foreground">
                {initials(event?.organizer || "?")}
              </AvatarFallback>
            </Avatar>
            <Input
              value={event?.organizer || ""}
              onChange={(e) => patch({ organizer: e.target.value })}
              placeholder="Who's hosting?"
            />
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarFile}
            />
            <Button
              variant="outline"
              className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              disabled={avatarBusy}
              onClick={() => avatarInput.current?.click()}
            >
              {avatarBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {organizerAvatar ? "Change photo" : "Add photo"}
            </Button>
            {organizerAvatar ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove organizer photo"
                className="shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                disabled={avatarBusy}
                onClick={() =>
                  saveAvatar("", organizerAvatar, "Organizer photo removed.")
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
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
        <div className="grid gap-4 sm:grid-cols-3">
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
          {/* Date/time are the same columns Location & Time edits — both write
              `date`/`time`, so the two sections stay in step. */}
          <Field label="Date">
            <EventDatePicker
              value={event?.date}
              onChange={(date) => patch({ date })}
            />
          </Field>
          <Field label="Start time">
            <EventTimeSelect
              value={event?.time}
              onChange={(time) => patch({ time })}
            />
          </Field>
        </div>
      </div>
      <p className="text-xs text-text-tertiary">
        Use <span className="font-medium text-text-secondary">Save Changes</span>{" "}
        at the top to persist these.
      </p>
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
