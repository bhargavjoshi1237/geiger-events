"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventConfig } from "@/lib/events/use-event-config";
import { SECTION_NOTE_TARGETS } from "./public_page/section_note";

let noteCounter = 0;
const newNote = () => {
  noteCounter += 1;
  return {
    id: `note_${Date.now()}_${noteCounter}`,
    target: "about",
    text: "",
    enabled: true,
  };
};

function NoteCard({ note, index, total, onPatch, onRemove }) {
  const set = (key) => (value) => onPatch(note.id, { [key]: value });
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-card p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <Field label="Section" htmlFor={`note-target-${note.id}`}>
            <Select value={note.target} onValueChange={set("target")}>
              <SelectTrigger id={`note-target-${note.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SECTION_NOTE_TARGETS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Switch
          checked={note.enabled !== false}
          onCheckedChange={(v) => onPatch(note.id, { enabled: v })}
          aria-label={note.enabled !== false ? "Note shown" : "Note hidden"}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={total <= 1}
          onClick={() => onRemove(note.id)}
          aria-label="Remove note"
          className="shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Field label="Note text" hint={`Shown as “i” #${index + 1} on the page`}>
        <Textarea
          rows={2}
          value={note.text || ""}
          onChange={(e) => set("text")(e.target.value)}
          placeholder="Anything attendees should know about this section."
        />
      </Field>
    </div>
  );
}

export function PageNotesSection({ event, headerItem }) {
  const [notes, setNotes, saveNotes, saving] = useEventConfig(
    event,
    "sectionNotes",
    [],
  );
  const items = Array.isArray(notes) ? notes : [];

  const patch = (id, partial) =>
    setNotes(items.map((n) => (n.id === id ? { ...n, ...partial } : n)));

  const add = () => setNotes([...items, newNote()]);

  const remove = async (id) => {
    const next = items.filter((n) => n.id !== id);
    setNotes(next);
    await saveNotes(next, { successMsg: "Note removed." });
  };

  const save = async () => {
    if (items.some((n) => !String(n.text || "").trim())) {
      toast.error("Every note needs text — or remove the empty ones.");
      return;
    }
    await saveNotes(undefined, { successMsg: "Section notes saved." });
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Section Notes"}
        description={
          headerItem?.desc ||
          "Attach a short note to any page section — it shows as an “i” next to the section's heading."
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={add}>
              <Plus className="h-4 w-4" /> Add note
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={save}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save notes"}
            </Button>
          </div>
        }
      />

      {items.length ? (
        <div className="space-y-3">
          {items.map((n, i) => (
            <NoteCard
              key={n.id}
              note={n}
              index={i}
              total={items.length}
              onPatch={patch}
              onRemove={remove}
            />
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={add}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
        >
          <Plus className="h-6 w-6" />
          <p className="text-sm">Add your first section note</p>
        </button>
      )}
    </div>
  );
}

export default PageNotesSection;
