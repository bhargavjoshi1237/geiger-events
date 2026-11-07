"use client";

import React, { useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Field, SectionCard, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { BANNED_WORD_ACTIONS, EDIT_WINDOW_OPTIONS, normalizeSettings } from "@/lib/boards/constants";

const parseWords = (text) =>
  String(text || "")
    .split(/[\n,]/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);

// Project-wide board settings. Mount with a `key` tied to the loaded settings so the draft resets after a reload.
export function SettingsTab({ settings, onSave }) {
  const initial = normalizeSettings(settings);
  const [draft, setDraft] = useState(initial);
  const [words, setWords] = useState(initial.bannedWords.join("\n"));
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setBusy(true);
    await onSave({ ...draft, bannedWords: parseWords(words) });
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Notifications" description="How members hear about replies. Each board can override the email default, and members can override both.">
        <SettingsList>
          <SettingRow
            title="Email members about replies"
            description="Replies to a member's topic, their reply, or a topic they follow. Off sends portal notifications only."
            checked={draft.emailDefault !== "off"}
            onCheckedChange={(v) => set("emailDefault")(v ? "on" : "off")}
          />
          <SettingRow
            title="Follow topics you reply to"
            description="Members who reply are subscribed to that topic's future replies."
            checked={draft.autoSubscribe}
            onCheckedChange={set("autoSubscribe")}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard title="Editing" description="How long members can edit or delete their own topics and replies.">
        <Field label="Edit window" className="max-w-xs">
          <Select value={String(draft.editWindowMinutes)} onValueChange={(v) => set("editWindowMinutes")(Number(v))}>
            <SelectTrigger className="bg-surface-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDIT_WINDOW_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </SectionCard>

      <SectionCard
        title="Banned words"
        description="Checked on the server whenever a member posts or edits. Whole words and phrases, any letter case."
      >
        <div className="grid gap-4">
          <Field label="Words and phrases" hint="One per line, or separated by commas.">
            <Textarea
              rows={6}
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder={"e.g.\nbuy followers\ncrypto giveaway"}
              className="resize-y bg-surface-card font-mono text-sm"
            />
          </Field>
          <Field label="When a post matches" className="max-w-xs">
            <Select value={draft.bannedWordAction} onValueChange={set("bannedWordAction")}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANNED_WORD_ACTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}

export default SettingsTab;
