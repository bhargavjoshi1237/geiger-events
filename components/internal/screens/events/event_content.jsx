"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
  Sparkles,
  HelpCircle,
  PlayCircle,
} from "lucide-react";

import { EditorSectionHeader, Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEventConfig } from "@/lib/events/use-event-config";

// Two authored-content sections for the public page — "What to expect"
// highlights and the FAQ. Both are ordered lists of small records kept in the
// event's metadata bag (like schedule/guests), so they grow without a
// migration. The public page renders them in ExpectBlock / FaqBlock and omits
// the section entirely when the list is empty — there is no sample fallback.

const MARKDOWN_HINT =
  "Supports **bold**, *italic*, [links](https://…), and - bullet lists.";

// Row editor driven by a field spec. The first field is the required one.
function ItemDialog({ open, onOpenChange, title, description, fields, initial, onSave }) {
  const blank = Object.fromEntries(fields.map((f) => [f.key, ""]));
  const [draft, setDraft] = useState(blank);

  // Re-seed whenever the dialog opens (render-phase reset — React's
  // recommended alternative to a setState-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial ? { ...blank, ...initial } : blank);
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const required = fields[0];

  const submit = () => {
    if (!String(draft[required.key] || "").trim()) {
      toast.error(`Add ${required.label.toLowerCase()} first.`);
      return;
    }
    onSave(
      Object.fromEntries(
        fields.map((f) => [f.key, String(draft[f.key] || "").trim()]),
      ),
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${title}` : `Add ${title}`}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {fields.map((f, i) => (
            <Field key={f.key} label={f.label} hint={f.hint} htmlFor={`fld-${f.key}`}>
              {f.type === "textarea" ? (
                <Textarea
                  id={`fld-${f.key}`}
                  rows={4}
                  value={draft[f.key] || ""}
                  onChange={(e) => set(f.key)(e.target.value)}
                  placeholder={f.placeholder}
                />
              ) : (
                <Input
                  id={`fld-${f.key}`}
                  value={draft[f.key] || ""}
                  onChange={(e) => set(f.key)(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={f.placeholder}
                  autoFocus={i === 0}
                />
              )}
            </Field>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            {initial ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Ordered list of records under one metadata key, with the suite's standard
// add / reorder / edit / delete row affordances.
function ListSection({
  event,
  headerItem,
  configKey,
  idPrefix,
  title,
  description,
  itemLabel,
  itemDescription,
  fields,
  addLabel,
  emptyLabel,
  emptyIcon: EmptyIcon,
}) {
  const [items, , saveItems] = useEventConfig(event, configKey, []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { index, item } | null

  const rows = Array.isArray(items) ? items : [];
  const [primary, secondary] = fields;

  const addItem = (item) =>
    saveItems([...rows, { ...item, id: `${idPrefix}_${Date.now()}` }], {
      successMsg: `${itemLabel} added.`,
    });

  const updateItem = (index, item) =>
    saveItems(
      rows.map((it, i) => (i === index ? { ...it, ...item } : it)),
      { successMsg: `${itemLabel} updated.` },
    );

  const removeItem = (index) => saveItems(rows.filter((_, i) => i !== index));

  const move = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= rows.length) return;
    const copy = [...rows];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    saveItems(copy);
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || title}
        description={headerItem?.desc || description}
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> {addLabel}
          </Button>
        }
      />

      {rows.length ? (
        <div className="space-y-2">
          {rows.map((it, i) => (
            <div
              key={it.id || i}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3"
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-text-tertiary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {it[primary.key]}
                </p>
                {it[secondary.key] ? (
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {it[secondary.key]}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditing({ index: i, item: it })}
                  aria-label="Edit"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeItem(i)}
                  aria-label="Delete"
                  className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
        >
          <EmptyIcon className="h-6 w-6" />
          <p className="text-sm">{emptyLabel}</p>
        </button>
      )}

      <ItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title={itemLabel.toLowerCase()}
        description={itemDescription}
        fields={fields}
        onSave={addItem}
      />
      <ItemDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={itemLabel.toLowerCase()}
        description={itemDescription}
        fields={fields}
        initial={editing?.item}
        onSave={(item) => {
          updateItem(editing.index, item);
          setEditing(null);
        }}
      />
    </div>
  );
}

export function HighlightsSection({ event, headerItem }) {
  return (
    <ListSection
      event={event}
      headerItem={headerItem}
      configKey="highlights"
      idPrefix="hl"
      title="What to expect"
      description="The handful of things attendees get out of this event. Shown as a highlights card near the top of your public page."
      itemLabel="Highlight"
      itemDescription="A short label and, optionally, a line explaining it."
      addLabel="Add highlight"
      emptyLabel="Add your first highlight"
      emptyIcon={Sparkles}
      fields={[
        {
          key: "title",
          label: "Highlight",
          placeholder: "e.g. Morning sessions",
        },
        {
          key: "detail",
          label: "Detail",
          hint: "Optional",
          type: "textarea",
          placeholder: "Timely, practical topics for primary care.",
        },
      ]}
    />
  );
}

export function FaqSection({ event, headerItem }) {
  return (
    <ListSection
      event={event}
      headerItem={headerItem}
      configKey="faq"
      idPrefix="faq"
      title="FAQ"
      description="Answer the questions buyers ask before they commit. Shown as an expandable list at the bottom of your public page."
      itemLabel="Question"
      itemDescription="A question and its answer, as attendees would ask it."
      addLabel="Add question"
      emptyLabel="Add your first question"
      emptyIcon={HelpCircle}
      fields={[
        {
          key: "q",
          label: "Question",
          placeholder: "e.g. What's the refund policy?",
        },
        {
          key: "a",
          label: "Answer",
          hint: MARKDOWN_HINT,
          type: "textarea",
          placeholder:
            "Full refunds up to 7 days before the event. After that, tickets are transferable.",
        },
      ]}
    />
  );
}

export function OnDemandVideoSection({ event, headerItem }) {
  return (
    <ListSection
      event={event}
      headerItem={headerItem}
      configKey="videos"
      idPrefix="vid"
      title="On-demand Video"
      description="Recordings, trailers, or walkthroughs attendees can watch any time. Add a link — YouTube, Vimeo, or a direct video file — and it's ready to play."
      itemLabel="Video"
      itemDescription="A title and the link where it can be watched on demand."
      addLabel="Add video"
      emptyLabel="Add your first video"
      emptyIcon={PlayCircle}
      fields={[
        {
          key: "title",
          label: "Title",
          placeholder: "e.g. Keynote replay",
        },
        {
          key: "url",
          label: "Video link",
          hint: "YouTube, Vimeo, or a direct mp4/webm file",
          placeholder: "https://www.youtube.com/watch?v=…",
        },
        {
          key: "description",
          label: "Description",
          hint: "Optional",
          type: "textarea",
          placeholder: "What this video is about, and who it's for.",
        },
      ]}
    />
  );
}

export default HighlightsSection;
