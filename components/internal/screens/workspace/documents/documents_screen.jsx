"use client";

import { useState } from "react";
import { Award, ChevronDown, Copy, FileText, Mail, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, LogoLoading, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@geiger/ui";
import { toast } from "sonner";
import { EditorSectionHeader, EmptyState, SearchInput, SegmentedTabs, Toolbar } from "@/components/internal/shared/screen_kit";
import { RecordSheet } from "../record/record_sheet";
import { timeAgo } from "../state/format";
import { useDocuments } from "../process/use_documents";
import { CertificatesView } from "./certificates_view";
import { blankEmail, EmailEditor } from "./email_editor";
import { blankPdf, PdfEditor } from "./pdf_editor";

const TABS = [{ label: "Templates", value: "templates" }, { label: "Certificates", value: "certificates" }];

// Email templates and PDF documents (letters, badges, invoices, certificates), plus the certificates issued from them.
export function DocumentsScreen({ eventId, ws }) {
  const documents = useDocuments(eventId);
  const [tab, setTab] = useState("templates");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [record, setRecord] = useState(null);
  const canConfigure = Boolean(ws.can?.configure);
  const firstList = ws.objects[0]?.id ?? null;

  if (editing) {
    const Editor = editing.kind === "email" ? EmailEditor : PdfEditor;
    return <Editor key={editing.id ?? "new"} eventId={eventId} ws={ws} documents={documents} document={editing} onClose={() => setEditing(null)} />;
  }
  if (!documents.data && documents.status !== "error") return <div className="flex justify-center py-20"><LogoLoading size={56} aria-label="Loading documents" /></div>;
  if (!documents.data) {
    return <EmptyState title="Couldn't load documents" description={documents.error?.message} action={<Button variant="outline" onClick={documents.reload}>Try again</Button>} />;
  }

  const term = search.trim().toLowerCase();
  const shown = documents.items.filter((item) => !term || item.name.toLowerCase().includes(term));
  const listName = (objectId) => ws.objects.find((object) => object.id === objectId)?.plural ?? null;
  const remove = (item) => documents.run("document.delete", { id: item.id }, { success: `“${item.name}” deleted` });
  const duplicate = async (item) => {
    const result = await documents.run("document.save", { document: { ...item, name: `${item.name} (copy)` } }, { handle: ["invalid_document"] });
    if (result.error) toast.error(result.error.message); else toast.success("Duplicated");
  };
  const newMenu = canConfigure ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button><Plus className="h-4 w-4" />New<ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setEditing(blankPdf(firstList))}><FileText className="h-4 w-4" />PDF document</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setEditing(blankEmail(firstList))}><Mail className="h-4 w-4" />Email template</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="space-y-5">
      <EditorSectionHeader title="Documents"
        description="Reusable emails and PDFs made from a record's fields — acceptance letters, badges, invoices, certificates. Make them by hand from a record or from an automation."
        action={newMenu} />
      <Toolbar>
        <SegmentedTabs value={tab} onChange={setTab} tabs={TABS} />
        <div className="flex items-center gap-2">
          {tab === "certificates" ? (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="valid">Valid</SelectItem><SelectItem value="revoked">Revoked</SelectItem></SelectContent>
            </Select>
          ) : null}
          <SearchInput value={search} onChange={setSearch} placeholder={tab === "templates" ? "Search templates" : "Search certificates"} />
        </div>
      </Toolbar>

      {tab === "certificates" ? (
        <CertificatesView eventId={eventId} api={documents.api} status={status} search={search} canRevoke={canConfigure} onOpenRecord={setRecord} />
      ) : shown.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-subtle">
          {shown.map((item) => {
            const Icon = item.kind === "email" ? Mail : item.config?.certificate?.enabled ? Award : FileText;
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary"><Icon className="h-4 w-4" /></div>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => canConfigure && setEditing(item)} disabled={!canConfigure}>
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {item.kind === "email" ? "Email template" : "PDF document"}{listName(item.objectId) ? ` · ${listName(item.objectId)}` : ""} · changed {timeAgo(item.updatedAt)}
                  </p>
                </button>
                {item.config?.certificate?.enabled ? <Badge variant="neutral" className="hidden sm:inline-flex">Certificate</Badge> : null}
                {canConfigure ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="More"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(item)}><Pencil className="h-4 w-4" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => duplicate(item)}><Copy className="h-4 w-4" />Duplicate</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onSelect={() => remove(item)}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={FileText} title={term ? "No templates match" : "No documents yet"}
            description={term ? "Try another search." : "Start with an acceptance letter or a certificate of attendance. Placeholders like {{Name}} fill in from each record."}
            action={!term ? newMenu : null} />
        </div>
      )}

      <RecordSheet open={Boolean(record)} onOpenChange={(open) => { if (!open) setRecord(null); }}
        eventId={eventId} data={ws.data} objectId={record?.objectId} recordId={record?.id} timeZone={ws.data.event?.timeZone}
        can={ws.can} run={ws.run} onOpenRecord={(id, objectId) => setRecord((current) => ({ id, objectId: objectId ?? current?.objectId }))} />
    </div>
  );
}
