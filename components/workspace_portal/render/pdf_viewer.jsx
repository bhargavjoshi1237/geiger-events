"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, LogoLoading } from "@geiger/ui";
import { toast } from "sonner";
import { FileViewerProvider } from "./portal_context";

const VIEWABLE = (type = "") => type === "application/pdf" || type.startsWith("image/");

// Opens PDFs and images in a large in-page viewer (a short-lived inline link) and downloads everything else.
export function FileViewer({ api, children }) {
  const [current, setCurrent] = useState(null);

  const open = useCallback(async (file, { recordId, fieldId }) => {
    const inline = Boolean(api.inlineFiles !== false && VIEWABLE(file.type));
    if (inline) setCurrent({ file, recordId, fieldId, url: null });
    const { data, error } = await api.signFile({ recordId, fieldId, fileId: file.id, inline });
    if (error || !data?.url) {
      setCurrent(null);
      toast.error(error?.message ?? "That file isn't available.");
      return;
    }
    if (inline) setCurrent((now) => (now?.file.id === file.id ? { ...now, url: data.url } : now));
    else window.open(data.url, "_blank", "noopener,noreferrer");
  }, [api]);

  const download = async () => {
    const { data, error } = await api.signFile({ recordId: current.recordId, fieldId: current.fieldId, fileId: current.file.id, inline: false });
    if (error || !data?.url) { toast.error(error?.message ?? "That file isn't available."); return; }
    window.open(data.url, "_blank", "noopener,noreferrer");
  };

  const value = useMemo(() => ({ open }), [open]);
  const isPdf = current?.file.type === "application/pdf";

  return (
    <FileViewerProvider value={value}>
      {children}
      <Dialog open={Boolean(current)} onOpenChange={(next) => { if (!next) setCurrent(null); }}>
        <DialogContent className="flex h-[92dvh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-4 py-3 pr-12">
            <FileText className="h-4 w-4 shrink-0 text-text-secondary" />
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="truncate text-sm">{current?.file.name}</DialogTitle>
              <DialogDescription className="text-xs">{current ? `${Math.max(1, Math.round((current.file.size ?? 0) / 1024)).toLocaleString()} KB` : ""}</DialogDescription>
            </div>
            {current?.url ? (
              <Button size="sm" variant="ghost" asChild>
                <a href={current.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /><span className="max-sm:hidden">Open</span></a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4" /><span className="max-sm:hidden">Download</span></Button>
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-surface-subtle">
            {!current?.url ? (
              <div className="flex h-full items-center justify-center"><LogoLoading size={48} aria-label="Opening file" /></div>
            ) : isPdf ? (
              <iframe title={current.file.name} src={current.url} className="h-full w-full border-0" />
            ) : (
              <div className="flex h-full items-center justify-center overflow-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
                <img src={current.url} alt={current.file.name} className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </FileViewerProvider>
  );
}
