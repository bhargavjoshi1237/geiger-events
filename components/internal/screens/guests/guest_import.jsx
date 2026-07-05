"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { Field, ScreenHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { listContacts, createContact } from "@/lib/supabase/contacts";
import { getUser } from "@/lib/supabase/user";
import { parseCsv } from "./csv_parse";

const IMPORT_FIELDS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "title", label: "Job title" },
  { key: "location", label: "Location" },
  { key: "tags", label: "Tags" },
];

const NONE = "__none__";
const STEPS = ["Upload", "Map columns", "Preview", "Done"];

// Guess which CSV column feeds a field from its header text.
function autoGuess(fieldKey, headers) {
  const aliases = {
    name: ["name", "full name", "contact"],
    email: ["email", "e-mail", "mail"],
    phone: ["phone", "mobile", "tel"],
    company: ["company", "organization", "org"],
    title: ["title", "job", "role"],
    location: ["location", "city", "country", "region"],
    tags: ["tags", "labels", "groups"],
  };
  const opts = aliases[fieldKey] || [fieldKey];
  const idx = headers.findIndex((h) =>
    opts.some((a) => h.toLowerCase().includes(a)),
  );
  return idx >= 0 ? String(idx) : NONE;
}

// Rendered standalone or as a Contact Book sub-view. `onBack` shows a return
// affordance; `onImported` lets the host refetch after a successful import.
export function GuestImportScreen({ onBack, onImported } = {}) {
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState({});
  const [existingEmails, setExistingEmails] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [userId, setUserId] = useState(null);
  const fileRef = useRef(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    listContacts(projectId).then((cs) => {
      if (!alive) return;
      setExistingEmails(
        new Set((cs ?? []).map((c) => c.email.toLowerCase()).filter(Boolean)),
      );
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const onFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const data = parseCsv(text);
    if (!data.headers.length || !data.rows.length) {
      toast.error("That CSV looks empty.");
      return;
    }
    setParsed(data);
    const guessed = {};
    for (const f of IMPORT_FIELDS) guessed[f.key] = autoGuess(f.key, data.headers);
    setMapping(guessed);
    setStep(1);
  };

  // Build contact drafts from the mapping (only rows with a name or email).
  const drafts = useMemo(() => {
    if (!parsed) return [];
    const pick = (row, key) => {
      const idx = mapping[key];
      if (idx === undefined || idx === NONE) return "";
      return String(row[Number(idx)] ?? "").trim();
    };
    return parsed.rows
      .map((row) => {
        const name = pick(row, "name");
        const email = pick(row, "email");
        if (!name && !email) return null;
        const tagsRaw = pick(row, "tags");
        return {
          name: name || email,
          email,
          phone: pick(row, "phone"),
          company: pick(row, "company"),
          title: pick(row, "title"),
          location: pick(row, "location"),
          tags: tagsRaw
            ? tagsRaw.split(/[;,]/).map((t) => t.trim()).filter(Boolean)
            : [],
        };
      })
      .filter(Boolean);
  }, [parsed, mapping]);

  const dupeCount = useMemo(
    () =>
      drafts.filter((d) => d.email && existingEmails.has(d.email.toLowerCase()))
        .length,
    [drafts, existingEmails],
  );

  const runImport = async () => {
    setImporting(true);
    let created = 0;
    let failed = 0;
    let noDb = false;
    for (const d of drafts) {
      const saved = await createContact({
        id: crypto.randomUUID(),
        projectId,
        status: "Active",
        createdBy: userId,
        ...d,
      });
      if (saved) created += 1;
      else if (saved === null) noDb = true;
      else failed += 1;
    }
    setImporting(false);
    setResult({ created, failed, total: drafts.length, noDb });
    setStep(3);
    if (noDb) toast.error("No database connected — nothing was imported.");
    else {
      toast.success(`Imported ${created} contact${created === 1 ? "" : "s"}.`);
      if (created) onImported?.();
    }
  };

  const reset = () => {
    setStep(0);
    setParsed(null);
    setMapping({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <SecondaryScreenWrapper>
      {onBack ? (
        <Button
          variant="ghost"
          className="-ml-2 w-fit text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" /> Back to contacts
        </Button>
      ) : null}
      <ScreenHeader
        title="Import contacts"
        description="Bring contacts in from a CSV — map your columns, preview, and import into the contact book."
      />

      <Stepper step={step} />

      {step === 0 ? (
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-subtle px-6 py-16 text-center transition-colors hover:bg-surface-hover"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files?.[0]);
          }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary">
            <FileUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Drop a CSV here, or click to browse
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              First row is treated as headers. Name or email required per row.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      ) : null}

      {step === 1 && parsed ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-subtle p-5">
            <p className="mb-4 text-sm text-text-secondary">
              Match each contact field to a column from your file
              (<span className="text-foreground">{parsed.rows.length}</span> rows).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Select
                    value={mapping[f.key] ?? NONE}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [f.key]: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Not imported —</SelectItem>
                      {parsed.headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h || `Column ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={reset}
            >
              <ArrowLeft className="h-4 w-4" /> Start over
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={mapping.name === NONE && mapping.email === NONE}
              onClick={() => setStep(2)}
            >
              Preview <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{drafts.length} to import</Badge>
            {dupeCount ? (
              <Badge variant="warning">
                {dupeCount} match an existing email
              </Badge>
            ) : null}
            {parsed && parsed.rows.length > drafts.length ? (
              <Badge variant="neutral">
                {parsed.rows.length - drafts.length} skipped (no name/email)
              </Badge>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface-subtle">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody>
                {drafts.slice(0, 8).map((d, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-foreground">{d.name}</td>
                    <td className="px-4 py-2 text-text-secondary">
                      {d.email || "—"}
                    </td>
                    <td className="px-4 py-2 text-text-secondary">
                      {d.company || "—"}
                    </td>
                    <td className="px-4 py-2 text-text-secondary">
                      {d.tags.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {drafts.length > 8 ? (
              <p className="px-4 py-2 text-xs text-text-tertiary">
                +{drafts.length - 8} more…
              </p>
            ) : null}
          </div>

          {dupeCount ? (
            <p className="text-xs text-text-tertiary">
              Duplicates are imported as new records — resolve them afterwards in
              Dedupe &amp; Merge.
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={importing || !drafts.length}
              onClick={runImport}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Import {drafts.length} contact{drafts.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 && result ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface-subtle px-6 py-14 text-center">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl border",
              result.noDb
                ? "border-border bg-surface-card text-text-secondary"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
            )}
          >
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {result.noDb
                ? "Nothing imported"
                : `Imported ${result.created} of ${result.total}`}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {result.noDb
                ? "Connect a database and try again."
                : result.failed
                  ? `${result.failed} row${result.failed === 1 ? "" : "s"} failed to save.`
                  : "All rows imported into the contact book."}
            </p>
          </div>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={reset}
          >
            Import another file
          </Button>
        </div>
      ) : null}
    </SecondaryScreenWrapper>
  );
}

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                i < step
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : i === step
                    ? "border-border-strong bg-surface-card text-foreground"
                    : "border-border bg-surface-subtle text-text-tertiary",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                i === step ? "font-medium text-foreground" : "text-text-secondary",
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 ? (
            <div className="h-px w-6 bg-border" />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

export default GuestImportScreen;
