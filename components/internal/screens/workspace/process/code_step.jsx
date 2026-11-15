"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button, Label, Textarea } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { liveFieldsOf } from "../state/use_workspace";
import { RecordPicker } from "../documents/editor_parts";

const PLACEHOLDER = "const words = (record.abstract ?? \"\").split(/\\s+/).filter(Boolean).length;\nreturn { set: { abstract_words: words } };";

// A code editor with line numbers: a monospace textarea beside a gutter that scrolls with it.
function CodeArea({ value, onChange }) {
  const [top, setTop] = useState(0);
  const lines = Math.max(10, (value ?? "").split("\n").length);
  return (
    <div className="relative flex overflow-hidden rounded-md border border-border bg-surface-card font-mono text-xs">
      <div aria-hidden className="select-none border-r border-border bg-surface-subtle px-2 py-2 text-right leading-5 text-text-tertiary" style={{ transform: `translateY(${-top}px)` }}>
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <Textarea value={value ?? ""} rows={12} spellCheck={false} wrap="off" placeholder={PLACEHOLDER} aria-label="Code"
        className="min-h-60 flex-1 resize-y rounded-none border-0 bg-transparent font-mono text-xs leading-5 shadow-none focus-visible:ring-0"
        onScroll={(event) => setTop(event.currentTarget.scrollTop)} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

// The "Run code" step: the code, what it can read, and a Test run against a chosen record.
export function CodeStepEditor({ ctx, step, onChange }) {
  const [recordId, setRecordId] = useState(null);
  const [test, setTest] = useState(null);
  const [busy, setBusy] = useState(false);
  const object = ctx.data.objects.find((item) => item.id === ctx.subjectId) ?? null;
  const keys = ctx.subjectId ? liveFieldsOf(ctx.data, ctx.subjectId).map((field) => field.key) : [];

  const run = async () => {
    setBusy(true);
    const { data, error } = await ctx.testCode({ code: step.code ?? "", recordId });
    setBusy(false);
    setTest(error ? { ok: false, error: error.message, logs: [] } : data);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label className="text-xs font-medium text-text-secondary">Code</Label>
        <CodeArea value={step.code} onChange={(code) => onChange({ ...step, code })} />
        <p className="text-xs text-text-tertiary">
          JavaScript in a sandbox: up to 1 second and 32 MB, no network or timers. Read <code>record</code>{keys.length ? ` (${keys.slice(0, 6).join(", ")}${keys.length > 6 ? ", …" : ""})` : ""}, <code>event</code>, <code>trigger</code> and <code>steps</code>.
          Return <code>{"{ set: { field_key: value }, status, output }"}</code> to change the record; <code>output</code> is available to later steps.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ctx.subjectId ? <div className="min-w-56 flex-1"><RecordPicker eventId={ctx.eventId} object={object} objectId={ctx.subjectId} value={recordId} onChange={setRecordId} /></div> : null}
        <Button type="button" variant="outline" onClick={run} disabled={busy || !(step.code ?? "").trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Test
        </Button>
      </div>
      {test ? (
        <div className={cn("space-y-2 rounded-lg border p-3 text-xs", test.ok ? "border-border" : "border-red-500/30 bg-red-500/5")}>
          <p className={cn("font-medium", test.ok ? "text-foreground" : "text-red-700 dark:text-red-300")}>{test.ok ? `Ran in ${test.ms} ms — nothing was changed` : test.error}</p>
          {test.ok ? <pre className="max-h-48 overflow-auto rounded bg-surface-subtle p-2">{JSON.stringify(test.result, null, 2)}</pre> : null}
          {test.logs?.length ? <pre className="max-h-32 overflow-auto rounded bg-surface-subtle p-2 text-text-secondary">{test.logs.join("\n")}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}
