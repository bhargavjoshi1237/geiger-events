"use client";

import { useEffect, useState } from "react";
import { Award, Copy, Download, ExternalLink, Loader2, MoreHorizontal, ShieldOff } from "lucide-react";
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger, Label, LogoLoading, Textarea,
} from "@geiger/ui";
import { toast } from "sonner";
import { DataTable, EmptyState } from "@/components/internal/shared/screen_kit";
import { workspaceApi } from "@/lib/workspace/client";
import { formatDate } from "../state/format";

function RevokeDialog({ certificate, api, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const { error } = await api.command({ action: "certificate.revoke", id: certificate.id, reason });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${certificate.code} revoked`);
    onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke {certificate.code}?</DialogTitle>
          <DialogDescription>The check page will say it was revoked and show your reason. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="ws-revoke-reason">Reason</Label>
          <Textarea id="ws-revoke-reason" rows={3} maxLength={500} value={reason} placeholder="Issued in error" onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={busy || !reason.trim()} onClick={submit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Revoke</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const matches = (certificate, term) => !term || [certificate.code, certificate.holder, certificate.title, certificate.record?.label]
  .some((value) => String(value ?? "").toLowerCase().includes(term));

// Issued certificates: who holds them, where to check them, and revoking.
export function CertificatesView({ eventId, api, status, search, canRevoke, onOpenRecord }) {
  const [state, setState] = useState({ key: null, rows: [], error: null });
  const [version, setVersion] = useState(0);
  const [revoking, setRevoking] = useState(null);
  const key = `${status}:${version}`;

  useEffect(() => {
    const controller = new AbortController();
    const [filter] = key.split(":");
    api.certificates(filter === "all" ? {} : { status: filter }, controller.signal)
      .then(({ data, error }) => { if (!controller.signal.aborted) setState({ key, rows: data?.certificates ?? [], error }); }).catch(() => {});
    return () => controller.abort();
  }, [api, key]);

  if (state.key !== key && !state.rows.length) return <div className="flex justify-center py-16"><LogoLoading size={48} aria-label="Loading certificates" /></div>;
  if (state.error) return <EmptyState title="Couldn't load certificates" description={state.error.message} action={<Button variant="outline" onClick={() => setVersion((n) => n + 1)}>Try again</Button>} />;

  const term = search.trim().toLowerCase();
  const rows = state.rows.filter((row) => matches(row, term));
  const copy = async (row) => { await navigator.clipboard.writeText(row.url); toast.success("Check link copied"); };
  const download = async (row) => {
    const { data, error } = await workspaceApi.download(eventId, row.fileId);
    if (error) toast.error(error.message); else if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
  };

  const columns = [
    { key: "code", header: "Code", render: (row) => <span className="font-mono text-sm text-foreground">{row.code}</span> },
    { key: "holder", header: "Issued to", render: (row) => <span className="font-medium text-foreground">{row.holder || "—"}</span> },
    { key: "title", header: "Certificate", render: (row) => <span className="text-text-secondary">{row.title}</span> },
    {
      key: "record", header: "Record", render: (row) => (row.record ? (
        <button type="button" className="text-left text-foreground underline-offset-2 hover:underline" onClick={(event) => { event.stopPropagation(); onOpenRecord?.(row.record); }}>{row.record.label}</button>
      ) : <span className="text-text-tertiary">—</span>),
    },
    { key: "issued", header: "Issued", render: (row) => <span className="whitespace-nowrap text-text-secondary">{formatDate(row.issuedAt)}</span> },
    { key: "status", header: "Status", render: (row) => (row.revokedAt ? <Badge variant="danger" title={row.revokedReason ?? undefined}>Revoked</Badge> : <Badge variant="success">Valid</Badge>) },
    {
      key: "actions", header: "", align: "right", render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Certificate actions" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => copy(row)}><Copy className="h-4 w-4" />Copy check link</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.open(row.url, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" />Open check page</DropdownMenuItem>
            {row.fileId ? <DropdownMenuItem onSelect={() => download(row)}><Download className="h-4 w-4" />Download PDF</DropdownMenuItem> : null}
            {canRevoke && !row.revokedAt ? <DropdownMenuItem className="text-red-600" onSelect={() => setRevoking(row)}><ShieldOff className="h-4 w-4" />Revoke</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={rows} getRowKey={(row) => row.id}
        empty={<div className="rounded-xl border border-border bg-surface-subtle"><EmptyState icon={Award} title={term ? "No certificates match" : "No certificates yet"}
          description={term ? "Try another search." : "Mark a PDF document as a certificate, then make it for a record or from an automation."} /></div>} />
      {revoking ? <RevokeDialog certificate={revoking} api={api} onClose={() => setRevoking(null)} onDone={() => { setRevoking(null); setVersion((n) => n + 1); }} /> : null}
    </>
  );
}
