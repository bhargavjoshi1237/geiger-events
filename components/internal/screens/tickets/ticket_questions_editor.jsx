"use client";

import React, { useEffect, useState } from "react";
import { GripVertical, HelpCircle, Loader2, Plus, Trash2 } from "lucide-react";

import {
  EmptyState,
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import {
  getQuestionsByIds,
  createQuestion,
  updateQuestion,
  softDeleteQuestion,
} from "@/lib/supabase/ticket_questions";
import { QUESTION_TYPE_OPTIONS } from "./constants";

// Editor for a ticket type's questions (asked per attendee at checkout, before
// paying). Questions are normalized rows in events.ticket_questions; the ticket
// only stores an ordered array of their ids in config.questionIds. Rows persist
// immediately (optimistic, matching records-kit); the questionIds link rides the
// ticket's normal Save button via setConfig.
export function TicketQuestionsEditor({ config, setConfig }) {
  const { projectId } = useProject();
  const [userId, setUserId] = useState(null);
  const [questions, setQuestions] = useState([]);

  const ids = Array.isArray(config.questionIds) ? config.questionIds : [];
  // Loading only matters when there's something to resolve; seed it from the
  // mount-time id count so the effect never has to setState synchronously.
  const [loading, setLoading] = useState(ids.length > 0);

  // Resolve config.questionIds -> ordered rows once on mount.
  useEffect(() => {
    let alive = true;
    getUser().then((u) => alive && setUserId(u?.id || null));
    if (ids.length) {
      getQuestionsByIds(ids).then((rows) => {
        if (!alive) return;
        const byId = new Map((rows ?? []).map((r) => [r.id, r]));
        setQuestions(ids.map((id) => byId.get(id)).filter(Boolean));
        setLoading(false);
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setIds = (nextIds) =>
    setConfig((c) => ({ ...c, questionIds: nextIds }));

  const add = () => {
    const q = {
      id: crypto.randomUUID(),
      projectId,
      label: "Untitled question",
      type: "text",
      options: [],
      required: false,
      createdBy: userId,
    };
    setQuestions((prev) => [...prev, q]);
    setIds([...ids, q.id]);
    createQuestion(q);
  };

  // Local edit; `commit` persists the current row (called on blur / control change).
  const edit = (id, patch) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const commit = (id, patch) => {
    edit(id, patch);
    updateQuestion(id, patch);
  };

  const remove = (id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setIds(ids.filter((x) => x !== id));
    softDeleteQuestion(id);
  };

  const move = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[index], next[j]] = [next[j], next[index]];
    setQuestions(next);
    setIds(next.map((q) => q.id));
  };

  return (
    <SectionCard
      title="Questions"
      description="Ask each attendee these before they pay. Answers are saved per ticket."
      action={
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={add}
        >
          <Plus className="h-4 w-4" /> Add question
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading questions…
        </div>
      ) : questions.length ? (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className="rounded-lg border border-border bg-surface-card p-3"
            >
              <div className="flex items-start gap-2">
                <div className="mt-2 flex flex-col text-text-tertiary">
                  <button
                    type="button"
                    aria-label="Move up"
                    className="hover:text-foreground disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ▲
                  </button>
                  <GripVertical className="h-4 w-4" />
                  <button
                    type="button"
                    aria-label="Move down"
                    className="hover:text-foreground disabled:opacity-30"
                    disabled={i === questions.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ▼
                  </button>
                </div>

                <div className="grid flex-1 gap-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                    <Field label="Question label">
                      <Input
                        value={q.label}
                        onChange={(e) => edit(q.id, { label: e.target.value })}
                        onBlur={() => updateQuestion(q.id, { label: q.label })}
                      />
                    </Field>
                    <Field label="Response type">
                      <Select
                        value={q.type}
                        onValueChange={(v) => commit(q.id, { type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {q.type === "select" ? (
                    <Field label="Options" hint="Comma-separated choices for the dropdown.">
                      <Input
                        value={(q.options || []).join(", ")}
                        onChange={(e) =>
                          edit(q.id, {
                            options: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        onBlur={() => updateQuestion(q.id, { options: q.options })}
                        placeholder="e.g. Small, Medium, Large"
                      />
                    </Field>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch
                        checked={!!q.required}
                        onCheckedChange={(v) => commit(q.id, { required: v })}
                      />
                      Required
                    </label>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove question"
                      className="text-red-300 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => remove(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={HelpCircle}
          title="No questions yet"
          description="Add a question to collect details from each attendee before they pay."
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={add}
            >
              <Plus className="h-4 w-4" /> Add question
            </Button>
          }
        />
      )}
    </SectionCard>
  );
}

export default TicketQuestionsEditor;
