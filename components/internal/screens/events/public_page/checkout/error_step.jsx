"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@geiger/ui/button";

export function ErrorStep({ checkout, accentStyle, onClose }) {
  const { errorMsg, setStep } = checkout;

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        <AlertCircle className="h-8 w-8" />
      </div>
      <p className="text-sm text-muted-foreground">{errorMsg}</p>
      <div className="flex w-full gap-2">
        <Button
          variant="outline"
          className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={onClose}
        >
          Close
        </Button>
        <Button
          style={accentStyle}
          className="flex-1 hover:opacity-90"
          onClick={() => setStep("details")}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
