"use client";

import React, { useSyncExternalStore } from "react";
import { CircleAlert, Monitor } from "lucide-react";

import Logo from "@geiger/ui/logo";
import { Button } from "@geiger/ui/button";
import { LoadingScreen } from "@geiger/ui/screen-kit";
import { cn } from "@/lib/utils";
import { suiteUrl } from "@/lib/desktop/config";
import { DesktopTitlebar } from "./desktop_titlebar";

const subscribeNothing = () => () => {};

// False on the server and while hydrating, true once the client has taken over.
export function useHydrated() {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

// Pinned to the dark palette like the suite login, whatever the OS theme is.
export function DesktopShell({ wide = false, actions = null, children }) {
  return (
    <div className="dark flex min-h-[100dvh] flex-col bg-background font-sans text-foreground">
      <DesktopTitlebar className="w-full shrink-0">
        <header className="flex h-14 items-center justify-between gap-4 px-6">
          <div className="inline-flex items-center gap-2 text-foreground">
            <Logo size={20} />
            <span className="text-sm font-semibold">Geiger Events</span>
          </div>
          {actions}
        </header>
      </DesktopTitlebar>
      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-4">
        <div className={cn("w-full", wide ? "max-w-[560px]" : "max-w-[420px]")}>{children}</div>
      </main>
    </div>
  );
}

export function DesktopLoading({ label = "Loading" }) {
  return (
    <div className="dark bg-background text-foreground">
      <LoadingScreen size={80} label={label} className="min-h-[100dvh]" />
    </div>
  );
}

// Bespoke rather than the kit's EmptyState, which capitalises every word of the copy.
export function StatePanel({ icon: Icon, title, description, note, children }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface-subtle px-6 py-10 text-center sm:px-8">
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary">
          <Icon className="size-6" />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="mt-1 flex w-full flex-col justify-center gap-2 sm:flex-row">{children}</div>
      ) : null}
      {note ? <p className="text-xs text-text-tertiary">{note}</p> : null}
    </div>
  );
}

export function ErrorNote({ children }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-left text-sm text-red-400"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// Production page opened in a normal browser: the flow needs the desktop shell's bridge.
export function BrowserOnlyState() {
  return (
    <DesktopShell>
      <StatePanel
        icon={Monitor}
        title="This page is for the Geiger Events desktop app"
        description="In a browser, open Events from your dashboard instead."
      >
        <Button asChild>
          <a href={suiteUrl("/org")}>Open the dashboard</a>
        </Button>
      </StatePanel>
    </DesktopShell>
  );
}
