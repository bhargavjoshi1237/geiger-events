"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Field, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { AudienceField } from "@/components/internal/shared/audience/audience_field";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { IconPicker } from "@geiger/ui/icon-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { normalizeSpec, isEmptyFilters } from "@/lib/audience/resolve";
import { BOARD_FORMATS, EMAIL_SETTINGS, POSTING_POLICIES } from "@/lib/boards/constants";

const blankDraft = () => ({
  name: "",
  description: "",
  icon: "MessagesSquare",
  format: "discussion",
  postingPolicy: "members",
  requireApproval: false,
  emailNotifications: "inherit",
  audience: normalizeSpec({ mode: "all" }),
});

function OptionSelect({ value, onChange, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-surface-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Create / edit a board. Mount with a fresh `key` per open so the draft resets.
export function BoardDialog({ open, onOpenChange, projectId, board, emailDefault = "on", onSave }) {
  const [draft, setDraft] = useState(() =>
    board
      ? {
          name: board.name,
          description: board.description,
          icon: board.icon,
          format: board.format,
          postingPolicy: board.postingPolicy,
          requireApproval: board.requireApproval,
          emailNotifications: board.emailNotifications,
          audience: board.audience,
        }
      : blankDraft(),
  );
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft.name.trim()) {
      toast.error("Give the board a name.");
      return;
    }
    const spec = normalizeSpec(draft.audience);
    if (spec.mode === "filtered" && isEmptyFilters(spec.filters) && !spec.include.length) {
      toast.error("Add targeting criteria or pick people, or switch the audience back to everyone.");
      return;
    }
    setBusy(true);
    const ok = await onSave({ ...draft, name: draft.name.trim(), description: draft.description.trim(), audience: spec });
    setBusy(false);
    if (ok !== false) onOpenChange(false);
  };

  const formatHint = BOARD_FORMATS.find((f) => f.value === draft.format)?.hint;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{board ? "Edit board" : "New board"}</DialogTitle>
          <DialogDescription>
            A persistent topic board members reach from the Discussions tab in their portal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Name">
              <Input
                value={draft.name}
                maxLength={80}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="e.g. Travel & stays"
                className="bg-surface-card"
              />
            </Field>
            <Field label="Icon">
              <IconPicker value={draft.icon} onValueChange={set("icon")} placeholder="Pick an icon" />
            </Field>
          </div>

          <Field label="Description" hint="Optional — one line on what belongs here.">
            <Textarea
              rows={2}
              maxLength={300}
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="e.g. Share lifts, hotel tips and travel plans."
              className="resize-none bg-surface-card"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Format" hint={formatHint}>
              <OptionSelect value={draft.format} onChange={set("format")} options={BOARD_FORMATS} />
            </Field>
            <Field label="Who starts topics">
              <OptionSelect value={draft.postingPolicy} onChange={set("postingPolicy")} options={POSTING_POLICIES} />
            </Field>
          </div>

          <Field
            label="Reply emails"
            hint={`Members can override this for themselves. Your default is currently ${emailDefault === "off" ? "in-app only" : "email"}.`}
          >
            <OptionSelect value={draft.emailNotifications} onChange={set("emailNotifications")} options={EMAIL_SETTINGS} />
          </Field>

          <div className="rounded-lg border border-border bg-surface-card px-3 py-3">
            <SettingsList>
              <SettingRow
                title="Approve new topics"
                description="Members' new topics wait in Moderation until you approve them."
                checked={draft.requireApproval}
                onCheckedChange={set("requireApproval")}
              />
            </SettingsList>
          </div>

          <Field
            label="Who can see it"
            hint="Pick an event to limit the board to its ticket holders, or keep it community-wide. Narrow further by ticket, tag, segment or people."
          >
            <AudienceField projectId={projectId} value={draft.audience} onChange={set("audience")} />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {board ? "Save board" : "Create board"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BoardDialog;
