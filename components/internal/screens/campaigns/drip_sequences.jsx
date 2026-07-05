"use client";

import React from "react";
import { Plus, Trash2, Workflow } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { RecordsScreen } from "../tickets/records_kit";
import {
  listAssets,
  createAsset,
  updateAsset,
  softDeleteAsset,
} from "@/lib/supabase/campaigns";
import {
  CHANNEL_OPTIONS,
  SEQUENCE_TRIGGER_OPTIONS,
  defaultSequenceConfig,
} from "./constants";

// Campaign assets data adapter (module = 'sequence').
const SEQUENCE_DATA = {
  list: listAssets,
  create: createAsset,
  update: updateAsset,
  remove: softDeleteAsset,
};

const KINDS = [
  { value: "sequence", label: "Sequence", defaultConfig: defaultSequenceConfig },
];

function summarize(r) {
  const c = r.config || {};
  const steps = Array.isArray(c.steps) ? c.steps.length : 0;
  const trigger =
    SEQUENCE_TRIGGER_OPTIONS.find((o) => o.value === c.trigger)?.label || "Manual enrolment";
  return `${steps} step${steps === 1 ? "" : "s"} · ${trigger}`;
}

function StepCard({ step, index, onChange, onRemove, removable }) {
  const isEmail = step.channel === "email";
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="neutral">Step {index + 1}</Badge>
          {step.delayDays > 0 ? (
            <span className="text-xs text-text-secondary">
              +{step.delayDays} day{step.delayDays === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-xs text-text-secondary">Immediately</span>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          disabled={!removable}
          className="h-8 w-8 text-text-tertiary hover:text-red-300"
          onClick={onRemove}
          aria-label="Remove step"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Channel">
          <Select value={step.channel} onValueChange={(v) => onChange({ channel: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Delay" hint="Days after the previous step (0 = same time).">
          <Input
            type="number"
            min={0}
            value={step.delayDays ?? 0}
            onChange={(e) => onChange({ delayDays: Number(e.target.value) || 0 })}
            className="tabular-nums"
          />
        </Field>
      </div>

      {isEmail ? (
        <div className="mt-3">
          <Field label="Subject">
            <Input
              value={step.subject || ""}
              onChange={(e) => onChange({ subject: e.target.value })}
              placeholder="Subject line"
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-3">
        <Field label={isEmail ? "Body" : "Message"}>
          <Textarea
            rows={isEmail ? 4 : 2}
            value={step.body || ""}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="What this step sends…"
          />
        </Field>
      </div>
    </div>
  );
}

function SequenceEditForm({ config, setConfig }) {
  const steps = Array.isArray(config.steps) ? config.steps : [];
  const set = (patch) => setConfig({ ...config, ...patch });

  const setStep = (i, patch) =>
    set({ steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addStep = () =>
    set({
      steps: [
        ...steps,
        { id: crypto.randomUUID(), channel: "email", delayDays: 1, subject: "", body: "" },
      ],
    });
  const removeStep = (i) => set({ steps: steps.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <SectionCard
        title="Enrolment trigger"
        description="What starts a contact down this sequence."
      >
        <Field label="Trigger" className="max-w-sm">
          <Select
            value={config.trigger || "registration"}
            onValueChange={(v) => set({ trigger: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEQUENCE_TRIGGER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </SectionCard>

      <SectionCard
        title="Steps"
        description="Messages sent in order, each after its delay."
        action={
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={addStep}
          >
            <Plus className="h-4 w-4" /> Add step
          </Button>
        }
      >
        <div className="space-y-3">
          {steps.length ? (
            steps.map((step, i) => (
              <StepCard
                key={step.id || i}
                step={step}
                index={i}
                onChange={(patch) => setStep(i, patch)}
                onRemove={() => removeStep(i)}
                removable={steps.length > 1}
              />
            ))
          ) : (
            <p className="py-6 text-center text-sm text-text-tertiary">
              No steps yet — add the first message to send.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export function DripSequencesScreen() {
  return (
    <RecordsScreen
      module="sequence"
      title="Drip Sequences"
      description="Automated multi-step message flows. Build a sequence once, then enrol contacts on a trigger."
      singular="sequence"
      icon={Workflow}
      kinds={KINDS}
      summarize={summarize}
      EditForm={SequenceEditForm}
      data={SEQUENCE_DATA}
    />
  );
}

export default DripSequencesScreen;
