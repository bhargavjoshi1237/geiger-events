"use client";

import React, { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Upload-or-paste image control. `onUpload(file)` returns a public URL (or null
// on failure) — the screen owns the toast, this only reports busy state.
export function ImageField({ label, value, onChange, onUpload, className }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    const url = await onUpload?.(file);
    setBusy(false);
    if (url) onChange(url);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <p className="text-sm font-medium text-muted-foreground">{label}</p> : null}

      {value ? (
        <div className="relative overflow-hidden rounded-md border border-border bg-surface-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-20 w-full object-contain" />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remove image"
            onClick={() => onChange("")}
            className="absolute right-1 top-1 h-6 w-6 bg-surface-subtle/80 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste an image URL…"
          className="bg-surface-card"
        />
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </Button>
      </div>
    </div>
  );
}

export default ImageField;
