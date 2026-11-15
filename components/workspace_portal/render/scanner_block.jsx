"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Loader2, ScanLine, Search, X } from "lucide-react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { QrScanner } from "@/components/checkin_routes/qr_scanner";
import { BlockError, BlockFrame, BlockLoading, BlockMessage, Restricted } from "./block_frame";
import { usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";

const timeOf = (value, timeZone) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
};

// Takes attendance: scan a workspace pass or an event ticket, type a code, or find someone by name.
export function ScannerBlock({ block, fill }) {
  const config = block.config;
  const { api, page, record, timeZone, refresh } = usePortalView();
  const { data, error, loading, reload } = useBlockData(block, {});
  const [contextId, setContextId] = useState(null);
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState({ q: "", items: [] });
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [camera, setCamera] = useState(false);
  const preview = Boolean(api.readOnly);
  const needsContext = config.context === "choose";
  const ready = !needsContext || Boolean(contextId);

  useEffect(() => {
    const q = query.trim();
    if (!config.search || q.length < 2) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.blockData({ pageId: page?.id, blockId: block.id, params: { search: q }, recordId: record?.id ?? null }, controller.signal)
        .then(({ data: result }) => { if (!controller.signal.aborted) setPeople({ q, items: result?.people ?? [] }); }).catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, block.id, config.search, page?.id, query, record?.id]);

  // Marks someone (or, in a preview, only checks who it would be).
  const mark = async (input) => {
    if (busy || !ready) return;
    setBusy(true);
    const body = { ...input, contextId, recordId: record?.id ?? null };
    const result = preview
      ? await api.blockData({ pageId: page?.id, blockId: block.id, params: body, recordId: record?.id ?? null })
      : await api.command({ action: "scan.mark", pageId: page?.id, blockId: block.id, ...body });
    setBusy(false);
    const entry = result.error
      ? { id: `${Date.now()}`, tone: "error", text: result.error.message }
      : result.data.already
        ? { id: `${Date.now()}`, tone: "repeat", text: `${result.data.person.label} was already marked${result.data.already.at ? ` at ${timeOf(result.data.already.at, timeZone)}` : ""}` }
        : { id: `${Date.now()}`, tone: "ok", text: preview ? `Would mark ${result.data.person.label}` : `${result.data.person.label} marked at ${timeOf(result.data.at, timeZone)}` };
    setLog((current) => [entry, ...current].slice(0, 12));
    if (!result.error && !preview && !result.data.already) refresh();
    if (!result.error) { setCode(""); setQuery(""); }
  };

  let body;
  if (loading) body = <BlockLoading label="Loading the scanner" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data?.restricted) body = <Restricted />;
  else if (!data?.canMark && !data?.preview) body = <BlockMessage icon={ScanLine} title="Not available to you" text="You can't take attendance here." />;
  else {
    const latest = log[0];
    body = (
      <div className="grid gap-4 p-4">
        {needsContext ? (
          <Select value={contextId ?? ""} onValueChange={setContextId}>
            <SelectTrigger className="h-9" aria-label="Taking attendance for"><SelectValue placeholder="Choose what you're taking attendance for" /></SelectTrigger>
            <SelectContent>{(data.contexts ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}
        {latest ? (
          <div role="status" className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
            latest.tone === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : latest.tone === "repeat" ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300")}>
            {latest.tone === "ok" ? <Check className="h-4 w-4 shrink-0" /> : latest.tone === "repeat" ? <Clock className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
            <span className="min-w-0">{latest.text}</span>
          </div>
        ) : null}
        {config.camera ? (
          camera ? (
            <div className="mx-auto w-full max-w-xs space-y-2">
              <QrScanner paused={busy || !ready} onDecode={(text) => mark({ code: text })} />
              <Button variant="outline" size="sm" className="w-full" onClick={() => setCamera(false)}>Stop the camera</Button>
            </div>
          ) : <Button variant="outline" disabled={!ready} onClick={() => setCamera(true)}><ScanLine className="h-4 w-4" />Scan with the camera</Button>
        ) : null}
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (code.trim()) mark({ code: code.trim() }); }}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Pass or ticket code" aria-label="Pass or ticket code" disabled={!ready} />
          <Button type="submit" disabled={!ready || busy || !code.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Check in</Button>
        </form>
        {config.search ? (
          <div className="grid gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Or find someone by name" className="pl-9" disabled={!ready} />
            </div>
            {query.trim().length >= 2 && people.q === query.trim() ? (
              people.items.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {people.items.map((person) => (
                    <li key={person.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{person.label}</span>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => mark({ personId: person.id })}>Check in</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-text-secondary">No one by that name.</p>
            ) : null}
          </div>
        ) : null}
        {log.length > 1 ? (
          <ol className="grid gap-1 text-xs text-text-secondary">
            {log.slice(1).map((entry) => <li key={entry.id} className="truncate">{entry.text}</li>)}
          </ol>
        ) : null}
      </div>
    );
  }

  return <BlockFrame title={config.title} fill={fill}>{body}</BlockFrame>;
}
