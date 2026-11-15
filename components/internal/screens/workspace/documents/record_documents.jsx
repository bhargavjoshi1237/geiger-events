"use client";

import { useState } from "react";
import { Award, FileText, Loader2 } from "lucide-react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch,
} from "@geiger/ui";
import { toast } from "sonner";
import { liveFieldsOf } from "../state/use_workspace";
import { useDocuments } from "../process/use_documents";
import { Row } from "./block_settings";

function GenerateDialog({ document, fileFields, documents, recordId, onClose, onDone }) {
  const [fieldId, setFieldId] = useState(fileFields[0]?.id ?? null);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const certificate = document.config?.certificate?.enabled;
  const submit = async () => {
    setBusy(true);
    const { data, error } = await documents.api.generate({ documentId: document.id, recordIds: [recordId], fieldId, replace });
    setBusy(false);
    const result = data?.results?.[0];
    if (error || result?.error) { toast.error(error?.message ?? result.error); return; }
    if (result.warnings?.length) toast.warning(result.warnings[0]);
    toast.success(result.certificate ? `Made ${result.file.name} — certificate ${result.certificate.code}` : `Made ${result.file.name}`);
    onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make “{document.name}”</DialogTitle>
          <DialogDescription>
            {certificate ? "Renders the PDF for this record, issues a certificate with a unique check code, and saves the file on the record." : "Renders the PDF for this record and saves it on the record."}
          </DialogDescription>
        </DialogHeader>
        {fileFields.length ? (
          <div className="space-y-3">
            <Row label="Save it in">
              <Select value={fieldId ?? ""} onValueChange={setFieldId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choose a file field" /></SelectTrigger>
                <SelectContent>{fileFields.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={replace} onCheckedChange={setReplace} />
              Replace an earlier copy{certificate ? " (and revoke its certificate)" : ""}
            </label>
          </div>
        ) : <p className="text-sm text-text-secondary">Add a file field to this list first — generated documents are saved there.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !fieldId} onClick={submit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Make it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The record sheet's Documents menu: make a PDF from a template, and open the certificates issued for this record.
export function RecordDocumentsMenu({ eventId, data, objectId, recordId, can, onGenerated }) {
  const documents = useDocuments(eventId);
  const [certificates, setCertificates] = useState(null);
  const [making, setMaking] = useState(null);
  const pdfs = documents.items.filter((item) => item.kind === "pdf" && (!item.objectId || item.objectId === objectId));
  const fileFields = liveFieldsOf(data, objectId).filter((field) => field.type === "attachments");
  if (!pdfs.length) return null;

  const loadCertificates = (open) => {
    if (!open) return;
    documents.api.certificates({ record: recordId }).then(({ data: result }) => setCertificates(result?.certificates ?? [])).catch(() => {});
  };

  return (
    <>
      <DropdownMenu onOpenChange={loadCertificates}>
        <DropdownMenuTrigger asChild><Button variant="outline"><FileText className="h-4 w-4" />Documents</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {can.update ? (
            <>
              <DropdownMenuLabel>Make a document</DropdownMenuLabel>
              {pdfs.map((item) => (
                <DropdownMenuItem key={item.id} onSelect={() => setMaking(item)}>
                  {item.config?.certificate?.enabled ? <Award className="h-4 w-4" /> : <FileText className="h-4 w-4" />}<span className="truncate">{item.name}</span>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          {certificates?.length ? (
            <>
              {can.update ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel>Certificates</DropdownMenuLabel>
              {certificates.map((item) => (
                <DropdownMenuItem key={item.id} onSelect={() => window.open(item.url, "_blank", "noopener,noreferrer")}>
                  <span className="font-mono text-xs">{item.code}</span>
                  <span className="ml-auto text-xs text-text-tertiary">{item.revokedAt ? "revoked" : "valid"}</span>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          {!can.update && !certificates?.length ? <DropdownMenuItem disabled>No certificates yet</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {making ? (
        <GenerateDialog document={making} fileFields={fileFields} documents={documents} recordId={recordId}
          onClose={() => setMaking(null)} onDone={() => { setMaking(null); onGenerated?.(); }} />
      ) : null}
    </>
  );
}
