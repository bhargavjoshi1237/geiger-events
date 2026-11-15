"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { Button, Input } from "@geiger/ui";

// An incoming-webhook address. Only a hash is stored, so the full address shows once, right after it's made.
export function HookAddress({ process, automation }) {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const make = async () => {
    setBusy(true);
    const result = await process.run("automation.hook", { id: automation.id }, { success: "New address ready" });
    setBusy(false);
    if (result.data?.url) setUrl(result.data.url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (url) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
          <Button type="button" variant="outline" size="icon" aria-label="Copy address" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
        </div>
        <p className="text-xs text-text-secondary">Copy it now — it won&apos;t be shown again. Steps can read the request body as {"{{payload.…}}"}.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" onClick={make} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{automation.hasHook ? "Make a new address" : "Create the address"}
      </Button>
      {automation.hasHook ? <span className="text-xs text-text-secondary">An address exists. Making a new one stops the old one working.</span> : null}
    </div>
  );
}
