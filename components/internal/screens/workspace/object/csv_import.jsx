"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import {
  Button, Label, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription,
  SheetFooter, SheetHeader, SheetTitle,
} from "@geiger/ui";
import { toast } from "sonner";
import { workspaceApi } from "@/lib/workspace/client";
import { parseCsv } from "@/lib/workspace/records/csv.js";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { plural } from "../state/format";

const SKIP = "__skip__";
const BATCH = 500;

// Upload a CSV, match its columns to fields, preview, then import in batches of 500.
export function CsvImportSheet({ open, onOpenChange, eventId, object, fields, onDone }) {
  const input = useRef(null);
  const [fileName, setFileName] = useState("");
  const [header, setHeader] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const targets = useMemo(() => [
    ...(object.statuses?.length ? [{ id: "status", name: "Status" }] : []),
    ...fields.filter((field) => getType(field.type).editable && field.type !== "attachments"),
  ], [object, fields]);

  const reset = () => { setFileName(""); setHeader([]); setRows([]); setMapping({}); setProgress(null); setResult(null); if (input.current) input.current.value = ""; };

  const read = async (file) => {
    if (!file) return;
    if (file.size > 20 * 1048576) { toast.error("Choose a CSV under 20 MB."); return; }
    const parsed = parseCsv(await file.text()).filter((row) => row.some((cell) => cell.trim() !== ""));
    if (parsed.length < 2) { toast.error("The file needs a header row and at least one record."); return; }
    const [head, ...body] = parsed;
    setFileName(file.name);
    setHeader(head);
    setRows(body);
    setResult(null);
    const auto = {};
    head.forEach((name, column) => {
      const match = targets.find((target) => target.name.toLowerCase() === name.trim().toLowerCase());
      if (match && !Object.values(auto).includes(match.id)) auto[column] = match.id;
    });
    setMapping(auto);
  };

  const run = async () => {
    const pairs = Object.entries(mapping).filter(([, fieldId]) => fieldId && fieldId !== SKIP).map(([column, fieldId]) => ({ column: Number(column), fieldId }));
    if (!pairs.length) { toast.error("Match at least one column to a field."); return; }
    let created = 0;
    const errors = [];
    setProgress(0);
    for (let offset = 0; offset < rows.length; offset += BATCH) {
      const { data, error } = await workspaceApi.importRows(eventId, { objectId: object.id, mapping: pairs, rows: rows.slice(offset, offset + BATCH), offset });
      if (error) { toast.error(error.message); break; }
      created += data.created;
      errors.push(...data.errors);
      setProgress(Math.min(100, Math.round(((offset + BATCH) / rows.length) * 100)));
    }
    setProgress(null);
    setResult({ created, errors });
    if (created) onDone?.();
  };

  const used = new Set(Object.values(mapping));
  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-base">Import {object.plural.toLowerCase()}</SheetTitle>
          <SheetDescription>From a CSV file with a header row. Links match a record&apos;s title or a person&apos;s email.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => read(event.target.files?.[0])} />
          <Button variant="outline" onClick={() => input.current?.click()}><FileUp className="h-4 w-4" />{fileName || "Choose a CSV file"}</Button>
          {header.length ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Match columns · {plural(rows.length, "row")}</p>
                {header.map((name, column) => (
                  <div key={column} className="grid grid-cols-2 items-center gap-3">
                    <Label className="truncate font-normal text-text-secondary" title={name}>{name || `Column ${column + 1}`}</Label>
                    <Select value={mapping[column] ?? SKIP} onValueChange={(fieldId) => setMapping((m) => ({ ...m, [column]: fieldId }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>Don&apos;t import</SelectItem>
                        {targets.map((target) => (
                          <SelectItem key={target.id} value={target.id} disabled={used.has(target.id) && mapping[column] !== target.id}>{target.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Preview</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-max text-xs">
                    <thead><tr className="border-b border-border">{header.map((name, i) => <th key={i} className="px-2 py-1.5 text-left font-medium text-text-secondary">{name}</th>)}</tr></thead>
                    <tbody>
                      {rows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-b-0">{header.map((_, j) => <td key={j} className="max-w-48 truncate px-2 py-1.5">{row[j]}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
          {progress !== null ? <Progress value={progress} /> : null}
          {result ? (
            <div className="space-y-2 rounded-lg border border-border bg-surface-subtle px-3 py-3 text-sm">
              <p className="font-medium text-foreground">Imported {plural(result.created, "record")}.</p>
              {result.errors.length ? (
                <>
                  <p className="text-text-secondary">{plural(result.errors.length, "row")} skipped:</p>
                  <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                    {result.errors.slice(0, 100).map((error) => <li key={error.row} className="text-text-secondary">Row {error.row}: {error.message}</li>)}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <SheetFooter className="flex-row justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{result ? "Close" : "Cancel"}</Button>
          {!result ? (
            <Button onClick={run} disabled={!rows.length || progress !== null}>
              {progress !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Import {rows.length ? plural(rows.length, "row") : ""}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
