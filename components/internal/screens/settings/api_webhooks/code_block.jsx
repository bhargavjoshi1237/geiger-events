"use client";

import { Copy } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { copyText } from "./constants";

// Monospace block with a copy button, for keys, secrets, payloads and code samples.
export function CodeBlock({ code, label, className, maxHeight = "max-h-80", copyMessage = "Copied" }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface-card", className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <span className="text-xs font-medium text-text-secondary">{label}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => copyText(code, copyMessage)}
            aria-label={`Copy ${label}`}
          >
            <Copy className="size-3.5" />
            Copy
          </Button>
        </div>
      ) : null}
      <pre className={cn("overflow-auto p-3 font-mono text-xs leading-relaxed text-foreground", maxHeight)}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// A single secret-like value on one line with a copy button.
export function CopyField({ value, copyMessage = "Copied", children }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 basis-64 break-all rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm text-foreground">
        {children ?? value}
      </code>
      <Button variant="outline" size="sm" onClick={() => copyText(value, copyMessage)}>
        <Copy className="size-3.5" />
        Copy
      </Button>
    </div>
  );
}

export default CodeBlock;
