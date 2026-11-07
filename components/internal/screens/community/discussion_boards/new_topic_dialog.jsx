"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { Field, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
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
import { LIMITS } from "@/lib/boards/constants";

// Start a topic as the organiser (the only way topics reach announcement boards).
export function NewTopicDialog({ open, onOpenChange, boards, defaultBoardId = "", onCreate }) {
  const active = (boards || []).filter((b) => !b.archived);
  const [draft, setDraft] = useState(() => ({
    boardId: defaultBoardId || active[0]?.id || "",
    title: "",
    body: "",
    tags: "",
    pinned: false,
  }));
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft.boardId) return toast.error("Pick a board.");
    if (draft.title.trim().length < 3) return toast.error("Give the topic a title.");
    if (!draft.body.trim()) return toast.error("Write the opening post.");
    setBusy(true);
    const ok = await onCreate(draft);
    setBusy(false);
    if (ok !== false) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New topic</DialogTitle>
          <DialogDescription>Posted as the organiser and published straight away.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Board">
            <Select value={draft.boardId} onValueChange={set("boardId")}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue placeholder={active.length ? "Choose a board…" : "Create a board first"} />
              </SelectTrigger>
              <SelectContent>
                {active.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Title">
            <Input
              value={draft.title}
              maxLength={LIMITS.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="e.g. Welcome — introduce yourself"
              className="bg-surface-card"
            />
          </Field>
          <Field label="Message" hint="Supports **bold**, *italic*, `code`, lists, > quotes and links.">
            <Textarea
              rows={6}
              value={draft.body}
              maxLength={LIMITS.body}
              onChange={(e) => set("body")(e.target.value)}
              className="resize-y bg-surface-card"
            />
          </Field>
          <Field label="Tags" hint="Optional — up to five, separated by commas.">
            <Input
              value={draft.tags}
              onChange={(e) => set("tags")(e.target.value)}
              placeholder="e.g. welcome, schedule"
              className="bg-surface-card"
            />
          </Field>
          <div className="rounded-lg border border-border bg-surface-card px-3 py-3">
            <SettingsList>
              <SettingRow
                title="Pin to the top"
                description="Keeps it above other topics on the board."
                checked={draft.pinned}
                onCheckedChange={set("pinned")}
              />
            </SettingsList>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Post topic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NewTopicDialog;
