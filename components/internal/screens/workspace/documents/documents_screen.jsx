"use client";

import { useState } from "react";
import { Award, ChevronDown, Copy, FileText, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import {
  ActionMenu, Badge, Button, DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, LoadingArea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@geiger/ui";
import { toast } from "sonner";
import { EmptyState, SearchInput, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { RecordSheet } from "../record/record_sheet";
import { PageBar, PageBody, PageToolbar, WorkspacePage } from "../shell/page";
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
    return (
      <WorkspacePage>
        <PageBody padded><Editor key={editing.id ?? "new"} eventId={eventId} ws={ws} documents={documents} document={editing} onClose={() => setEditing(null)} /></PageBody>
      </WorkspacePage>
    );
  }
  if (!documents.data) {
    return (
      <WorkspacePage>
        <PageBar icon={FileText} title="Documents" />
        {documents.status === "error" ? (
          <EmptyState title="Couldn't load documents" description={documents.error?.message} action={<Button variant="outline" onClick={documents.reload}>Try again</Button>} />
        ) : <LoadingArea size={56} label="Loading documents" />}
      </WorkspacePage>
    );
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
      <DropdownMenuTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />New<ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setEditing(blankPdf(firstList))}><FileText className="h-4 w-4" />PDF document</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setEditing(blankEmail(firstList))}><Mail className="h-4 w-4" />Email template</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;
  const columns = [
    {
      key: "name", header: "Document", render: (item) => {
        const Icon = item.kind === "email" ? Mail : item.config?.certificate?.enabled ? Award : FileText;
        return (
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground"><Icon className="h-4 w-4" /></span>
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium text-foreground">{item.name}</span>
              <span className="truncate text-xs text-text-secondary">{item.kind === "email" ? "Email template" : "PDF document"}</span>
            </span>
          </span>
        );
      },
    },
    { key: "list", header: "List", headClassName: "hidden md:table-cell", className: "hidden text-muted-foreground md:table-cell", render: (item) => listName(item.objectId) ?? "—" },
    { key: "kind", header: "", headClassName: "hidden sm:table-cell", className: "hidden sm:table-cell", render: (item) => (item.config?.certificate?.enabled ? <Badge variant="neutral">Certificate</Badge> : null) },
    { key: "changed", header: "Changed", align: "right", headClassName: "hidden sm:table-cell", className: "hidden whitespace-nowrap text-text-secondary sm:table-cell", render: (item) => timeAgo(item.updatedAt) },
    {
      key: "actions", header: "", align: "right", render: (item) => (canConfigure ? (
        <ActionMenu label={`Actions for ${item.name}`} items={[
          { icon: Pencil, label: "Edit", onSelect: () => setEditing(item) },
          { icon: Copy, label: "Duplicate", onSelect: () => duplicate(item) },
          { separator: true },
          { icon: Trash2, label: "Delete", destructive: true, onSelect: () => remove(item) },
        ]} />
      ) : null),
    },
  ];

  return (
    <WorkspacePage>
      <PageBar icon={FileText} title="Documents" note="Emails and PDFs made from a record's fields" actions={newMenu} />
      <PageToolbar>
        <SegmentedTabs value={tab} onChange={setTab} tabs={TABS} className="w-auto shrink-0" />
        <div className="flex items-center gap-2">
          {tab === "certificates" ? (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-36 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="valid">Valid</SelectItem><SelectItem value="revoked">Revoked</SelectItem></SelectContent>
            </Select>
          ) : null}
          <SearchInput value={search} onChange={setSearch} placeholder={tab === "templates" ? "Search templates" : "Search certificates"} />
        </div>
      </PageToolbar>

      <PageBody padded>
        {tab === "certificates" ? (
          <CertificatesView eventId={eventId} api={documents.api} status={status} search={search} canRevoke={canConfigure} onOpenRecord={setRecord} />
        ) : (
          <DataTable columns={columns} data={shown} getRowKey={(item) => item.id} onRowClick={canConfigure ? setEditing : undefined}
            empty={(
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState icon={FileText} title={term ? "No templates match" : "No documents yet"}
                  description={term ? "Try another search." : "Start with an acceptance letter or a certificate of attendance. Placeholders like {{Name}} fill in from each record."}
                  action={!term ? newMenu : null} />
              </div>
            )} />
        )}
      </PageBody>

      <RecordSheet open={Boolean(record)} onOpenChange={(open) => { if (!open) setRecord(null); }}
        eventId={eventId} data={ws.data} objectId={record?.objectId} recordId={record?.id} timeZone={ws.data.event?.timeZone}
        can={ws.can} run={ws.run} onOpenRecord={(id, objectId) => setRecord((current) => ({ id, objectId: objectId ?? current?.objectId }))} />
    </WorkspacePage>
  );
}
