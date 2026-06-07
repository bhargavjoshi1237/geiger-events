"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  ImageIcon,
  FileText,
  ClipboardList,
  UploadCloud,
  Plus,
  Trash2,
  GripVertical,
  Bold,
  Italic,
  List,
  Link2,
  Heading,
  Image as ImgIcon,
  Star,
} from "lucide-react";

import {
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Cover Media -------------------------------------------------------------

const GALLERY = [1, 2, 3, 4, 5];

export function CoverMediaSection({ event }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Cover image"
        description="Recommended 1600×900 (16:9), JPG or PNG, under 5 MB."
      >
        <button
          type="button"
          onClick={() => toast.success("Choose a file to upload.")}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#2a2a2a] bg-[#202020] text-[#737373] transition-colors hover:border-[#3a3a3a] hover:text-[#a3a3a3]"
        >
          <UploadCloud className="h-8 w-8" />
          <div className="text-center">
            <p className="text-sm font-medium text-[#d4d4d4]">
              Drag & drop, or click to upload
            </p>
            <p className="text-xs">16:9 · up to 5 MB</p>
          </div>
        </button>
      </SectionCard>

      <SectionCard
        title="Gallery"
        description="Extra photos shown lower on the event page."
        action={
          <Button
            size="sm"
            variant="outline"
            className="border-[#2a2a2a] bg-transparent text-[#d4d4d4] hover:bg-[#252525] hover:text-white"
          >
            <Plus className="h-4 w-4" /> Add photos
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {GALLERY.map((n) => (
            <div
              key={n}
              className="group relative flex aspect-square items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#202020] text-[#525252]"
            >
              <ImgIcon className="h-6 w-6" />
              {n === 1 ? (
                <Badge variant="info" className="absolute left-2 top-2">
                  <Star className="h-3 w-3" /> Cover
                </Badge>
              ) : null}
              <button
                type="button"
                className="absolute right-2 top-2 rounded-md bg-black/60 p-1 text-[#a3a3a3] opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// --- Rich Descriptions -------------------------------------------------------

const TOOLBAR = [
  { icon: Heading, label: "Heading" },
  { icon: Bold, label: "Bold" },
  { icon: Italic, label: "Italic" },
  { icon: List, label: "List" },
  { icon: Link2, label: "Link" },
  { icon: ImgIcon, label: "Image" },
];

const SNIPPETS = [
  "What to expect",
  "How to get there",
  "Refund policy",
  "Code of conduct",
];

export function RichDescriptionsSection({ event }) {
  const [text, setText] = useState(
    "Join us for an evening of talks and networking.\n\nDoors open at 6:30pm. Drinks and snacks provided. Bring a friend!",
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <SectionCard title="Description" bodyPadding={false}>
          <div className="flex items-center gap-1 border-b border-[#2a2a2a] px-3 py-2">
            {TOOLBAR.map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.label}
                  variant="ghost"
                  size="icon-sm"
                  title={t.label}
                  className="text-[#a3a3a3] hover:bg-[#252525] hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
          <div className="p-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="border-0 bg-transparent px-0 focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between border-t border-[#2a2a2a] px-4 py-3">
            <span className="text-xs text-[#525252]">
              {text.length} characters
            </span>
            <Button
              size="sm"
              className="bg-white text-[#161616] hover:bg-[#e7e7e7]"
              onClick={() => toast.success("Description saved.")}
            >
              Save
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Saved blocks"
          description="Insert reusable sections."
        >
          <div className="space-y-2">
            {SNIPPETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toast.success(`Inserted "${s}" block.`)}
                className="flex w-full items-center justify-between rounded-lg border border-[#2a2a2a] bg-[#202020] px-3 py-2.5 text-left text-sm text-[#d4d4d4] transition-colors hover:bg-[#252525]"
              >
                {s}
                <Plus className="h-4 w-4 text-[#737373]" />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// --- Custom Questions --------------------------------------------------------

const QUESTION_TYPES = [
  { value: "short", label: "Short text" },
  { value: "long", label: "Paragraph" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "number", label: "Number" },
];

const INITIAL_QUESTIONS = [
  { id: 1, label: "Full name", type: "short", required: true },
  { id: 2, label: "Dietary requirements", type: "select", required: false },
  { id: 3, label: "T-shirt size", type: "select", required: false },
  { id: 4, label: "How did you hear about us?", type: "long", required: false },
];

export function CustomQuestionsSection({ event }) {
  const [questions, setQuestions] = useState(INITIAL_QUESTIONS);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ label: "", type: "short", required: false });

  const typeLabel = (v) =>
    QUESTION_TYPES.find((t) => t.value === v)?.label || v;

  const addQuestion = () => {
    if (!draft.label.trim()) {
      toast.error("Add a question label.");
      return;
    }
    setQuestions((q) => [...q, { ...draft, id: Date.now() }]);
    setDraft({ label: "", type: "short", required: false });
    setOpen(false);
    toast.success("Question added.");
  };

  const remove = (id) =>
    setQuestions((q) => q.filter((x) => x.id !== id));
  const toggleRequired = (id) =>
    setQuestions((q) =>
      q.map((x) => (x.id === id ? { ...x, required: !x.required } : x)),
    );

  return (
    <div className="space-y-6">
      <SectionCard
        title="Registration form"
        description="Questions appear in this order on the registration page."
        action={
          <Button
            className="bg-white text-[#161616] hover:bg-[#e7e7e7]"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add question
          </Button>
        }
      >
        <div className="space-y-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className="flex items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#202020] px-3 py-3"
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#525252]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#ededed]">
                  {q.label}
                </p>
                <p className="text-xs text-[#737373]">{typeLabel(q.type)}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#a3a3a3]">
                Required
                <Switch
                  checked={q.required}
                  onCheckedChange={() => toggleRequired(q.id)}
                />
              </label>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-[#737373] hover:bg-red-500/10 hover:text-red-400"
                onClick={() => remove(q.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add question</DialogTitle>
            <DialogDescription>
              Create a custom field for your registration form.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Question label">
              <Input
                value={draft.label}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, label: e.target.value }))
                }
                placeholder="e.g. Dietary requirements"
              />
            </Field>
            <Field label="Answer type">
              <Select
                value={draft.type}
                onValueChange={(v) => setDraft((d) => ({ ...d, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center justify-between rounded-lg border border-[#2a2a2a] bg-[#202020] px-3 py-2.5 text-sm text-[#d4d4d4]">
              Required question
              <Switch
                checked={draft.required}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, required: v }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-[#2a2a2a] bg-transparent text-[#d4d4d4] hover:bg-[#252525] hover:text-white"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-white text-[#161616] hover:bg-[#e7e7e7]"
              onClick={addQuestion}
            >
              Add question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
