"use client";

// Last line of defence for the public event pages. A themed page renders
// organizer-authored content — cloned markup, custom code, imported brand
// styling — so a bad block must show a page a visitor can act on rather than the
// blank document an uncaught render error otherwise leaves behind.

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@geiger/ui/button";

export default function PublishedEventError({ error, retry }) {
  useEffect(() => {
    console.error("[e/:id] render failed", error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-subtle text-text-secondary">
        <TriangleAlert className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">
          This page didn&apos;t load
        </h1>
        <p className="max-w-sm text-sm text-text-secondary">
          Something went wrong while rendering the event. Trying again usually
          clears it.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCw className="h-4 w-4" /> Try again
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Link href="/home">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
