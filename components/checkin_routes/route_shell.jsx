"use client";

import React from "react";
import { LogOut, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Full-screen shell shared by the staff routes (/checkin, /kiosk, /door). Dark,
// chrome-free, with the event name, an optional live counter, and an exit that
// clears the unlocked session.
export function RouteShell({ title, subtitle, count, onExit, children, className }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {subtitle ? (
            <p className="truncate text-xs text-text-secondary">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {count ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 tabular-nums">
              <Activity className="h-3.5 w-3.5" />
              {count.checkedIn}
              {typeof count.expected === "number" && count.expected > 0
                ? ` / ${count.expected}`
                : ""}{" "}
              in
            </span>
          ) : null}
          {onExit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onExit}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Exit
            </Button>
          ) : null}
        </div>
      </header>
      <main className={cn("mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6", className)}>
        {children}
      </main>
    </div>
  );
}

export default RouteShell;
